# Integración con Express — @jmlq/logger-plugin-mongo 🚏

## 🎯 Objetivo

Mostrar el patrón de integración con Express:

- construir datasource Mongo
- componerlo con `@jmlq/logger`
- inyectar `ILogger` en `req.logger`

---

## 1) Crear `IMongoQueryClient` (adapter del driver)

El plugin define el contrato `IMongoQueryClient` y el host lo implementa con `MongoClient`.

```ts
xport interface MongoCreateIndexOptions {
  name?: string;
  unique?: boolean;
  expireAfterSeconds?: number;
}

export interface IMongoQueryClient {
  // lifecycle (el host decide si los usa)
  connect(): Promise<void>;
  close(): Promise<void>;

  // collection ops
  hasCollection(dbName: string, collectionName: string): Promise<boolean>;
  createCollection(dbName: string, collectionName: string): Promise<void>;

  // data ops
  insertOne<T = any>(
    dbName: string,
    collectionName: string,
    document: T
  ): Promise<IMongoQueryResult<T>>;

  find<T = any>(
    dbName: string,
    collectionName: string,
    filter?: Record<string, any>,
    options?: { limit?: number; skip?: number; sort?: Record<string, 1 | -1> }
  ): Promise<IMongoQueryResult<T>>;

  deleteMany(
    dbName: string,
    collectionName: string,
    filter: Record<string, any>
  ): Promise<IMongoQueryResult>;

  // index ops
  listIndexes(
    dbName: string,
    collectionName: string
  ): Promise<MongoIndexInfo[]>;
  createIndex(
    dbName: string,
    collectionName: string,
    key: MongoIndexKey,
    options?: MongoCreateIndexOptions
  ): Promise<void>;
  dropIndex(
    dbName: string,
    collectionName: string,
    indexName: string
  ): Promise<void>;
}


---
//src/domain/ports/mongo/schema-initializer.port.ts

export interface ISchemaInitializerPort {
  ensureSchema(): Promise<void>;
}


---
//src/domain/request/index.ts

export * from "./log-filter.request";
export * from "./save-log.request";


---
//src/domain/request/log-filter.request.ts

import { LogLevel } from "../value-objects";

// Filtro opcional para recuperar logs desde un datasource
export interface LogFilterRequest {
  levelMin?: LogLevel; // recuperar desde un nivel mínimo
  since?: number; // epoch millis desde
  until?: number; // epoch millis hasta
  limit?: number; // máximo de elementos
  offset?: number; // desplazamiento para paginación
  query?: string; /
```

---

## 2) Crear datasource del plugin

```ts
----------------------------------------------------------------
import {
  SaveLogUseCase,
  FindLogsUseCase,
  PruneLogsUseCase,
  EnsureSchemaUseCase,
} from "../../application/use-cases";

/**
 * createMongoDatasource
 * -----------------------------------------------------------------------------
 * Composition Root del plugin MongoDB.
 *
 * Responsabilidad:
 * - Construir el grafo de dependencias (repo, services, use-cases)
 * - Exponer un ILogDatasource compatible con @jmlq/logger
 *
 * Clean Architecture:
 * - Vive en application (consistente con PostgreSQL).
 * - No depende del driver mongodb.
 * - El host provee el IMongoQueryClient.
 */
export async function createMongoDatasource(
  opts: IMongoDatasourceOptions
): Promise<ILogDatasource> {
  const dbName = opts.dbName;
  const collectionName = opts.collectionName ?? "logs";

  // ---------------------------------------------------------------------------
  // 1) Repository (infraestructura) — Mongo real solo vía IMongoQueryClient
  // ---------------------------------------------------------------------------
  const repo = new MongoLogsRepository(opts.client, dbName, collectionName);

  // ---------------------------------------------------------------------------
  // 2) Bootstrap opcional (asegurar colección + índices + TTL)
  // ---------------------------------------------------------------------------
  const createIfMissing = opts.createIfMissing ?? true;
  const ensureIndexes = opts.ensureIndexes ?? true;

  const ensureSchemaUseCase =
    createIfMissing || ensureIndexes
      ? new EnsureSchemaUseCase(
          opts.client,
          dbName,
          collectionName,
          createIfMissing,
          ensureIndexes,
          opts.retentionDays ?? null,
          opts.extraIndexes ?? []
        )
      : undefined;

  if (ensureSchemaUseCase) {
    await ensureSchemaUseCase.execute();
  }

  // ---------------------------------------------------------------------------
  // 3) Use-cases (application)
  // ---------------------------------------------------------------------------
  const saveLogUseCase = new SaveLogUseCase(repo);
  const findLogsUseCase = new FindLogsUseCase(repo);
  const pruneLogsUseCase = opts.enablePrune
    ? new PruneLogsUseCase(repo)
    : undefined;

  // ---------------------------------------------------------------------------
  // 4) Adapter (infraestructura) que expone contrato del core
  // ---------------------------------------------------------------------------
  return new MongoDatasourceAdapter(
    saveLogUseCase,
    findLogsUseCase,
    ensureSchemaUseCase,
    pruneLogsUseCase
  );
}


---
//src/application/factory/index.ts

export * from "./create-mongo-datasource.factory";


---
//src/application/index.ts

export * from "./factory";
export * from "./use-
```

---

## 3) Componer con el core

```ts
import { createLogger, LogLevel } from "@jmlq/logger";

const logger = createLogger({
  datasources: [mongoDatasource],
  minLevel: LogLevel.INFO,
});
```

---

## 4) Middleware `attachLogger`

```ts
import type { Request, Response, NextFunction } from "express";
import type { ILogger } from "@jmlq/logger";

export function attachLogger(logger: ILogger) {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { logger?: ILogger }).logger = logger;
    next();
  };
}
```

---

## 5) Uso real en controllers

Se observa uso de `req.logger?.<level>(...)` en el host:

```ts
roles: [{ role: "user" }],
      });

      if (result.delivery) {
        const verifyLink = buildVerifyEmailLink(result.delivery.token);

        // OJO: si te preocupa exponer el token, también puedes evitar loguear verifyLink.
        req.logger?.info("auth.register.delivery", {
          email: result.delivery.email,
          expiresAt: result.delivery.expiresAt,
          hasDelivery: true,
        });

        await req.mailer.send({
          to: { email: result.delivery.email },
          subject: "Verificar Email",
          templateId: "verify-email",
          templateData: {
            app: envs.APP_NAME,
            verifyLink,
            expiresAt: result.delivery.expiresAt,
          },
        });
      }

      return res.status
```

```ts
Function,
  ) {
    try {
      const { email, payload } = await rememberValidations(req);

      if (payload.delivery) {
        const resetLink = buildResetLink(payload.delivery.resetToken);

        // ✅ No loguear el link/token
        req.logger?.info("auth.remember.delivery", {
          email: payload.delivery.email,
          expiresAt: payload.delivery.expiresAt,
          hasDelivery: true,
        });

        await req.mailer.send({
          to: { email },
          subject: "Restablecer contraseña",
          templateId: "reset-password",
          templateData: {
            app: envs.APP_NAME,
            resetLink,
            expiresAt: payload.delivery.expiresAt,
          },
        });
      }

      return res.status(200).json({
```

---

## 6) Cierre controlado

Recomendación en shutdown del host:

- `await logger.flush?.()` (si el datasource lo soporta)
- cerrar el `MongoClient` desde el host (lifecycle del driver)

---

## ⬅️ Anterior

- [`arquitectura`](./architecture.md)

## ➡️ Siguiente

- [Configuración](./configuration.md)
- [Troubleshooting](./troubleshooting.md)
