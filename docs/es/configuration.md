# Configuración — @jmlq/logger-plugin-mongo ⚙️

## 🎯 Objetivo

Configurar el datasource MongoDB (colección, índices, retención) y su integración con `@jmlq/logger`.

---

## 1) Dependencias

```bash
npm i @jmlq/logger @jmlq/logger-plugin-mongo mongodb
```

---

## 2) Opciones del datasource

La configuración se pasa a `createMongoDatasource(options)`:

```ts
{ IMongoQueryClient } from "../../domain/ports";
import { ExtraIndexConfig } from "../../infrastructure/types";

export interface IMongoDatasourceOptions {
  client: IMongoQueryClient;

  dbName: string;
  collectionName?: string;

  // bootstrap
  createIfMissing?: boolean;
  ensureIndexes?: boolean;

  // retention
  retentionDays?: number | null;
  enablePrune?: boolean;

  // indexes
  extraIndexes?: ExtraIndexConfig[];
}


---
//src/application/use-cases/ensure-schema.use-case.ts

import type { IMongoQueryClient } from "../../domain/ports";
import type { ExtraIndexConfig } from "../../infrastructure/types";
import { bootstrapMongoCollectionAndIndexes } from "../../infrastructure/services";

export class EnsureSchemaUseCase {
  constructor(
    private readonly client: IMongoQueryClient,
    private readonly dbName: string,
    private readonly collectionName: string,
    private readonly createIfMissing: boolean,
    private readonly ensureIndexes: boolean,
    private readonly retentionDays: number | null,
    private readonly extraIndexes: ExtraIndexConfig[]
  ) {}

  async execute(): Promise<void> {
    await bootstrapMongoCollectionAndIndexes({
      client: this.client,
      dbName: this.dbName,
      collectionName: this.collectionName,
      createIfMissing: this.createIfMissing,
      ensureIndexes: this.ensureIndexes
```

### Campos comunes (según implementación)

- `client`: `IMongoQueryClient` (adapter del driver)
- `dbName`: nombre de la base
- `collectionName`: nombre de colección
- `createIfMissing`: crea colección si no existe (si aplica)
- `ensureIndexes`: crea/verifica índices (si aplica)
- `retentionDays`: TTL/retención (si aplica)
- `extraIndexes`: configuración de índices adicionales (si aplica)

---

## 3) Variables de entorno recomendadas (.env)

El plugin no consume `process.env` directamente; el host decide cómo cargar envs.

```ts
const mongoUrl = process.env.LOGGER_MONGO_DB_URL;
const dbName = process.env.LOGGER_MONGO_DB_NAME;
const collectionName = process.env.LOGGER_MONGO_COLLECTION_NAME;
```

---

## 4) Índices y retención

Si `ensureIndexes` y/o `retentionDays` están habilitados, se delega al servicio de esquema:

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

## 5) Integración con `@jmlq/logger`

Una vez creado el datasource, se integra al core:

```ts
import { createLogger, LogLevel } from "@jmlq/logger";
import { createMongoDatasource } from "@jmlq/logger-plugin-mongo";

const mongoDs = await createMongoDatasource({
  client: mongoClientAdapter,
  dbName,
  collectionName,
  ensureIndexes: true,
  retentionDays: 7,
});

const logger = createLogger({
  datasources: [mongoDs],
  minLevel: LogLevel.INFO,
});
```

---

## ⬅️ Anterior

- [`arquitectura`](./architecture.md)

## ➡️ Siguiente

- [Integración Express](./integration-express.md)
- [Troubleshooting](./troubleshooting.md)
