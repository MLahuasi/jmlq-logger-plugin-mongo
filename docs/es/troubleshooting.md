# Troubleshooting — @jmlq/logger-plugin-mongo 🩺

## 🎯 Objetivo

Resolver problemas comunes al usar el datasource MongoDB como destino de `@jmlq/logger`.

---

## 1) No se crea la colección/índices

Revisar:

- `createIfMissing` / `ensureIndexes` (si tu configuración los usa)
- permisos del usuario MongoDB
- que el host llame a `createMongoDatasource(...)` en bootstrap

Referencia (schema/index service):

```ts
,
    });

    return res.deletedCount ?? 0;
  }
}


---
//src/infrastructure/services/index.ts

export * from "./mongo-schema.service";


---
//src/infrastructure/services/mongo-schema.service.ts

import { IMongoQueryClient, MongoIndexInfo } from "../../domain/ports";
import type { ExtraIndexConfig, MongoInfra, MongoPluginConfig } from "../types";

/**
 * Helper interno (no export): asegura la colección si hace falta.
 */
async function ensureMongoCollectionIfNeeded(opts: {
  client: IMongoQueryClient;
  dbName: string;
  collectionName: string;
  createIfMissing: boolean;
}): Promise<void> {
  const { client, dbName, collectionName, createIfMissing } = opts;

  const exists = await client.hasCollection(dbName, collectionName);

  if (!exists) {
    if (!createIfMissing) {
      throw new Error(
        `Mongo collection "${collectionName}" does not exist and createIfMissing=false`
      );
    }
    await client.createCollection(dbName, collectionName);
  }
}

/**
 * ensureMongoSchema
 * -----------------------------------------------------------------------------
 * Asegura índices base + TTL opcional + índices extra.
 *
 * Regla:
 * - Siempre crea el índice compuesto { level: 1, timestamp: 1 }
 * - Re-crea SIEMPRE el índice simple sobre timestamp para aplicar TTL deseado:
 *    - si retentionDays > 0 => { timestamp: 1 } + expireAfterSeconds
 *    - si no => { timestamp: 1 } sin TTL
 */
export async function ensureMongoSchema(opts: {
  client: IMongoQueryClient;
  dbName: string;
  collectionName: string;
  retentionDays: number | null;
  extraIndexes: ExtraIndexConfig[];
}): Promise<void> {
  const { client, dbName, collectionName, retentionDays, extraIndexes } = opts;

  // 1) Índice compuesto base (idempotente por name)
  await client.createIndex(
    dbName,
    collectionName,
    { level: 1, timestamp: 1 },
    { name: "idx_level_ts" }
  );

  // 2) Re-crear índice timestamp para aplicar TTL deseado
  const existing = await client.listIndexes(dbName, collectionName);

  const onlyTimestamp = findOnlyTimestampIndex(existing);
  if (onlyTimestamp) {
    await client.dropIndex(dbName, collectionName, onlyTimestamp.name);
  }

  const useTTL = typeof retentionDays === "number" && retentionDays > 0;

  if (useTTL) {
    const expireAfterSeconds = Math.ceil(retentionDays * 24 * 60 * 60);
```

---

## 2) Error de conexión (URI)

Patrón típico en host:

- resolver URI desde `process.env.LOGGER_MONGO_DB_URL`
- crear `MongoClient(uri)`
- conectar antes de usar

Si el host no conecta, el datasource no podrá persistir.

---

## 3) Los logs no aparecen

Checklist:

- `minLevel` del core permite el nivel usado (`INFO`, `ERROR`, etc.)
- el datasource se pasó realmente a `createLogger({ datasources: [...] })`
- el repositorio inserta (no falla silenciosamente)

Referencia (repository):

```ts
iver mongodb
 * - Usa IMongoQueryClient (puerto)
 * - Mantiene la misma semántica que PostgresLogsRepository
 */
export class MongoLogsRepository implements IMongoLogsRepository {
  constructor(
    private readonly client: IMongoQueryClient,
    private readonly dbName: string,
    private readonly collection: string
  ) {}

  // ---------------------------------------------------------------------------
  // HEALTHCHECK
  // ---------------------------------------------------------------------------

  async healthcheck(): Promise<void> {
    // Operación mínima y segura
    await this.client.find(this.dbName, this.collection, {}, { limit: 1 });
  }

  // ---------------------------------------------------------------------------
  // INSERT
  // ---------------------------------------------------------------------------

  async insert(log: LogEntry): Promise<void> {
    await this.client.insertOne(this.dbName, this.collection, {
      source: log.source ?? null,
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      meta: log.meta ?? null,
    });
  }

  // ---------------------------------------------------------------------------
  // FIND
  // ---------------------------------------------------------------------------

  async find(filter: LogFilterRequest): Promise<ILogResponse[]> {
    const f = filter ?? {};
    const query: Record<string, any> = {};

    if (f.levelMin != null) {
      query.level = { ...(query.level ?? {}), $gte: f.levelMin };
    }

    if (f.since != null) {
      query.timestamp = { ...(query.timestamp ?? {}), $gte: f.since };
    }

    if (f.until != null) {
      query.timestamp = { ...(query.timestamp ?? {}), $lte: f.until };
    }

    if (f.query && f.query.trim().length > 0) {
      query.message = { $regex: f.query.trim(), $options: "i" };
    }

    // Estrategia idéntica a Postgres:
    // 1) ordenar ASC
    // 2) paginar
    // 3) invertir en memoria (DESC final)
    const options: {
      sort?: Record<string, 1 | -1>;
      limit?: number;
      skip?: number;
    } = {
      sort: { timestamp: 1 },
    };

    const hasLimit = typeof f.limit === "number";
    const hasOffsetPage =
      typeof f.offset === "number" && Number.isFinite(f.offset) && f.offset > 0;

    if (hasLimit) {
      options.limit = f.limit;

      if (ha
```

---

## 4) La retención no funciona

Si estás usando TTL/retención:

- confirma que el índice TTL se crea con `expireAfterSeconds`
- verifica que el campo timestamp usado sea consistente

---

## 5) getLogs(...) no funciona con Mongo

Para soportar lectura, el datasource debe exponer `find` (vía `ILogDatasource.find?`).  
Confirma que el adapter implemente el método de búsqueda:

```ts
* - NO conoce mongodb (driver).
 * - NO gestiona el lifecycle de conexiones (eso lo maneja el factory/host).
 */
export class MongoDatasourceAdapter implements ILogDatasource {
  readonly name = "mongo";

  constructor(
    private readonly saveLogUseCase: SaveLogUseCase,
    private readonly findLogsUseCase: FindLogsUseCase,
    private readonly ensureSchemaUseCase?: EnsureSchemaUseCase,
    private readonly pruneLogsUseCase?: PruneLogsUseCase
  ) {}

  // ---------------------------------------------------------------------------
  // Core contract
  // ---------------------------------------------------------------------------

  async save(log: CoreLogEntry): Promise<void> {
    const dto: SaveLogRequest = { log };
    await this.saveLogUseCase.execute(dto);
  }

  async find(filter?: LogSearchRequest): Promise<LogRecord[]> {
    // Si tu dominio usa el mismo shape que el core:
    const domainFilter = (filter ?? {}) as any;

    const result = await this.findLogsUseCase.execute(domainFilter);

    // Si el use-case retorna ILogResponse dominio, mapearías aquí.
    // Si ya retorna LogRecord del core, devuelves directo.
    return result as any;
  }

  /**
   * Mongo en este plugin no tiene buffer interno.
   * Se implementa por estandarización del contrato.
   */
  async flush(): Promise<void> {
    // noop
  }

  /**
   * Este adapter NO es dueño del client/conexión.
   * El ciclo de vida lo gestiona el factory/host.
   */
  async dispose(): Promise<void> {
    // noop
  }

  // ---------------------------------------------------------------------------
  // Plugin features (opcionales)
  // ---------------------------------------------------------------------------

  /**
   * Inicializa colección/índices/TTL (si el factory inyectó EnsureSchemaUseCase).
   * NO forma parte del contrato core, pero unifica el rol de MongoSchemaInitializer.
   */
  async ensureSchema(): Promise<void> {
    if (!this.ensureSchemaUseCase) return;
    await this.ensureSchemaUseCase.execute();
  }

  /**
   * Retención manual (si el factory inyectó PruneLogsUseCase).
   */
  async pruneOlderThan(days: number): Promise<number> {
    if (!this.pruneLogsUseCase) return 0;
    return this.pruneLogsUseCase.execute({ days });
  }
}


---
//src/infrastructure/repositories/index.ts

export * from "./mongo-logs.repository";


---
//src/infrastructure/repositories/mongo-logs.repository.ts

import { LogEntry } from "../../domain/model";
import { LogFilterRequest } from "../../domain/request";
import { ILogResponse } from "../../domain/response";
import { IMongoLogsRepository, IMongoQueryClient } from "../../domain/ports";

/**
```

---

## ⬅️ Anterior

- [`arquitectura`](./architecture.md)

## ➡️ Siguiente

- [Configuración](./configuration.md)
- [Integración Express](./integration-express.md)
