# Express Integration — @jmlq/logger-plugin-mongo 🚏

## 🎯 Objective

Show the integration pattern with Express:

- build the Mongo datasource
- compose it with `@jmlq/logger`
- inject `ILogger` into `req.logger`

---

## 1) Create `IMongoQueryClient` (driver adapter)

The plugin defines the `IMongoQueryClient` contract, and the host implements it using `MongoClient`.

```ts
export interface MongoCreateIndexOptions {
  name?: string;
  unique?: boolean;
  expireAfterSeconds?: number;
}

export interface IMongoQueryClient {
  // lifecycle (the host decides if/when to use them)
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

// Optional filter to retrieve logs from a datasource
export interface LogFilterRequest {
  levelMin?: LogLevel;
  since?: number;
  until?: number;
  limit?: number;
  offset?: number;
  query?: string;
}
```

---

## 2) Create plugin datasource

```ts
import {
  SaveLogUseCase,
  FindLogsUseCase,
  PruneLogsUseCase,
  EnsureSchemaUseCase,
} from "../../application/use-cases";

/**
 * createMongoDatasource
 * -----------------------------------------------------------------------------
 * MongoDB plugin Composition Root.
 *
 * Responsibility:
 * - Build the dependency graph (repo, services, use cases)
 * - Expose an ILogDatasource compatible with @jmlq/logger
 *
 * Clean Architecture:
 * - Lives in application (consistent with PostgreSQL).
 * - Does not depend on mongodb driver.
 * - The host provides IMongoQueryClient.
 */
export async function createMongoDatasource(
  opts: IMongoDatasourceOptions
): Promise<ILogDatasource> {
  const dbName = opts.dbName;
  const collectionName = opts.collectionName ?? "logs";

  // ---------------------------------------------------------------------------
  // 1) Repository (infrastructure) — Mongo only via IMongoQueryClient
  // ---------------------------------------------------------------------------
  const repo = new MongoLogsRepository(opts.client, dbName, collectionName);

  // ---------------------------------------------------------------------------
  // 2) Optional bootstrap (collection + indexes + TTL)
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
  // 3) Use cases (application)
  // ---------------------------------------------------------------------------
  const saveLogUseCase = new SaveLogUseCase(repo);
  const findLogsUseCase = new FindLogsUseCase(repo);
  const pruneLogsUseCase = opts.enablePrune
    ? new PruneLogsUseCase(repo)
    : undefined;

  // ---------------------------------------------------------------------------
  // 4) Adapter (infrastructure) exposing core contract
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

## 3) Compose with core

```ts
import { createLogger, LogLevel } from "@jmlq/logger";

const logger = createLogger({
  datasources: [mongoDatasource],
  minLevel: LogLevel.INFO,
});
```

---

## 4) `attachLogger` middleware

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

## 5) Real usage in controllers

Typical usage of `req.logger?.<level>(...)` in the host:

```ts
roles: [{ role: "user" }],
      });

      if (result.delivery) {
        const verifyLink = buildVerifyEmailLink(result.delivery.token);

        // NOTE: avoid logging the token/link if sensitive
        req.logger?.info("auth.register.delivery", {
          email: result.delivery.email,
          expiresAt: result.delivery.expiresAt,
          hasDelivery: true,
        });

        await req.mailer.send({
          to: { email: result.delivery.email },
          subject: "Verify Email",
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

        // ✅ Do not log link/token
        req.logger?.info("auth.remember.delivery", {
          email: payload.delivery.email,
          expiresAt: payload.delivery.expiresAt,
          hasDelivery: true,
        });

        await req.mailer.send({
          to: { email },
          subject: "Reset password",
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

## 6) Graceful shutdown

Recommended in host shutdown:

- `await logger.flush?.()` (if supported by datasource)
- close `MongoClient` from the host (driver lifecycle)

---

## ⬅️ Previous

- [`architecture`](./architecture.md)

## ➡️ Next

- [Configuration](./configuration.md)
- [Troubleshooting](./troubleshooting.md)
