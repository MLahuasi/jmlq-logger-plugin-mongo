# Configuration — @jmlq/logger-plugin-mongo ⚙️

## 🎯 Objective

Configure the MongoDB datasource (collection, indexes, retention) and its integration with `@jmlq/logger`.

---

## 1) Dependencies

```bash
npm i @jmlq/logger @jmlq/logger-plugin-mongo mongodb
```

---

## 2) Datasource options

Configuration is passed to `createMongoDatasource(options)`:

```ts
import { IMongoQueryClient } from "../../domain/ports";
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

### Common fields (based on implementation)

- `client`: `IMongoQueryClient` (driver adapter)
- `dbName`: database name
- `collectionName`: collection name
- `createIfMissing`: creates collection if it does not exist (if applicable)
- `ensureIndexes`: creates/verifies indexes (if applicable)
- `retentionDays`: TTL/retention (if applicable)
- `extraIndexes`: additional index configuration (if applicable)

---

## 3) Recommended environment variables (.env)

The plugin does not consume `process.env` directly. The host is responsible for loading env values:

```ts
const mongoUrl = process.env.LOGGER_MONGO_DB_URL;
const dbName = process.env.LOGGER_MONGO_DB_NAME;
const collectionName = process.env.LOGGER_MONGO_COLLECTION_NAME;
```

---

## 4) Indexes and retention

If `ensureIndexes` and/or `retentionDays` are enabled, the schema service is used:

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

## 5) Integration with `@jmlq/logger`

Once the datasource is created, integrate it into the core:

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

## ⬅️ Previous

- [`architecture`](./architecture.md)

## ➡️ Next

- [Express Integration](./integration-express.md)
- [Troubleshooting](./troubleshooting.md)
