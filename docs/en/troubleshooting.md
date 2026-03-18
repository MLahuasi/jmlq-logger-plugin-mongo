# Troubleshooting — @jmlq/logger-plugin-mongo 🩺

## 🎯 Objective

Resolve common issues when using the MongoDB datasource as a target for `@jmlq/logger`.

---

## 1) Collection / indexes are not created

Check:

- `createIfMissing` / `ensureIndexes` (if your configuration uses them)
- MongoDB user permissions
- that the host calls `createMongoDatasource(...)` during bootstrap

Reference (schema/index service):

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
 * Internal helper (not exported): ensures the collection if needed.
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
 * Ensures base indexes + optional TTL + extra indexes.
 *
 * Rule:
 * - Always creates the compound index { level: 1, timestamp: 1 }
 * - Always re-creates the single index on timestamp to apply TTL:
 *    - if retentionDays > 0 => { timestamp: 1 } + expireAfterSeconds
 *    - otherwise => { timestamp: 1 } without TTL
 */
export async function ensureMongoSchema(opts: {
  client: IMongoQueryClient;
  dbName: string;
  collectionName: string;
  retentionDays: number | null;
  extraIndexes: ExtraIndexConfig[];
}): Promise<void> {
  const { client, dbName, collectionName, retentionDays, extraIndexes } = opts;

  // 1) Base compound index (idempotent by name)
  await client.createIndex(
    dbName,
    collectionName,
    { level: 1, timestamp: 1 },
    { name: "idx_level_ts" }
  );

  // 2) Re-create timestamp index to apply TTL
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

## 2) Connection error (URI)

Typical pattern in host:

- resolve URI from `process.env.LOGGER_MONGO_DB_URL`
- create `MongoClient(uri)`
- connect before using

If the host does not connect, the datasource cannot persist logs.

---

## 3) Logs are not appearing

Checklist:

- core `minLevel` allows the used level (`INFO`, `ERROR`, etc.)
- datasource is actually passed to `createLogger({ datasources: [...] })`
- repository inserts correctly (no silent failures)

Reference (repository):

```ts
/**
 * Mongo repository
 * - Uses IMongoQueryClient (port)
 * - Keeps the same semantics as PostgresLogsRepository
 */
export class MongoLogsRepository implements IMongoLogsRepository {
  constructor(
    private readonly client: IMongoQueryClient,
    private readonly dbName: string,
    private readonly collection: string,
  ) {}

  // ---------------------------------------------------------------------------
  // HEALTHCHECK
  // ---------------------------------------------------------------------------

  async healthcheck(): Promise<void> {
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

      if (hasOffsetPage) {
        options.skip = f.offset * f.limit;
      }
    }

    return (await this.client.find(
      this.dbName,
      this.collection,
      query,
      options,
    )) as any;
  }
}
```

---

## 4) Retention is not working

If you are using TTL/retention:

- confirm the TTL index is created with `expireAfterSeconds`
- verify the `timestamp` field used is consistent

---

## 5) getLogs(...) does not work with Mongo

To support reads, the datasource must expose `find` (via `ILogDatasource.find?`).
Confirm that the adapter implements the search method:

```ts
/**
 * Mongo datasource adapter
 * - Does NOT know mongodb (driver)
 * - Does NOT manage connection lifecycle (handled by factory/host)
 */
export class MongoDatasourceAdapter implements ILogDatasource {
  readonly name = "mongo";

  constructor(
    private readonly saveLogUseCase: SaveLogUseCase,
    private readonly findLogsUseCase: FindLogsUseCase,
    private readonly ensureSchemaUseCase?: EnsureSchemaUseCase,
    private readonly pruneLogsUseCase?: PruneLogsUseCase
  ) {}

  async save(log: CoreLogEntry): Promise<void> {
    const dto: SaveLogRequest = { log };
    await this.saveLogUseCase.execute(dto);
  }

  async find(filter?: LogSearchRequest): Promise<LogRecord[]> {
    const domainFilter = (filter ?? {}) as any;
    const result = await this.findLogsUseCase.execute(domainFilter);
    return result as any;
  }

  async flush(): Promise<void> {
    // noop
  }

  async dispose(): Promise<void> {
    // noop
  }

  async ensureSchema(): Promise<void> {
    if (!this.ensureSchemaUseCase) return;
    await this.ensureSchemaUseCase.execute();
  }

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

## ⬅️ Previous

- [`architecture`](./architecture.md)

## ➡️ Next

- [Configuration](./configuration.md)
- [Express Integration](./integration-express.md)
