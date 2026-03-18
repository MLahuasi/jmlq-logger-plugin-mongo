# @jmlq/logger-plugin-mongo 🍃

Persistence plugin for **MongoDB** compatible with `@jmlq/logger`.

This package implements a datasource that fulfills the `ILogDatasource` contract from the core, allowing:

- Save logs in MongoDB
- Create collection (optional) and manage indexes (optional)
- Define retention via TTL (optional) and/or cleanup strategy (depending on configuration)

---

## 🎯 Objective

Provide a **decoupled MongoDB implementation** (Clean Architecture) for the `@jmlq/logger` logging system, maintaining:

- Core without MongoDB dependencies
- Persistence as a reusable plugin
- Clear contracts for testing and extensions

## ⭐ Importance

MongoDB is a common destination for logs when you need:

- fast writes
- flexible queries (level, source, dates, text)
- automatic retention (TTL)

This plugin encapsulates driver details and keeps the host integration clean.

---

## 🏗 Architecture (quick view)

- **Recommended entry:** `createMongoDatasource(options)`
- Implements `ILogDatasource` and integrates with `createLogger({ datasources: [...] })`
- Separates:
  - Domain (ports/models)
  - Application (use-cases/factory)
  - Infrastructure (repository + schema/index)

➡️ See details: [architecture.md](./docs/en/architecture.md)

---

## 🔧 Implementation

### 5.1 Installation

```bash
npm i @jmlq/logger @jmlq/logger-plugin-mongo mongodb
```

### 5.2 Dependencies

- `@jmlq/logger` (core)
- `mongodb` (official driver in the host; the plugin uses an `IMongoQueryClient` port to avoid coupling)

### 5.3 Usage (create datasource + connect with core)

Typical flow:

1. Implement/adapt an `IMongoQueryClient` using the official driver.
2. Create the datasource via `createMongoDatasource(...)`.
3. Pass it to `createLogger(...)`.

#### Main factory (plugin)

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
 * Composition Root of the MongoDB plugin.
 *
 * Responsibility:
 * - Build the dependency graph (repo, services, use-cases)
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
  // 2) Optional bootstrap (ensure collection + indexes + TTL)
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

➡️ More details: [docs/integration-express.md](./docs/en/integration-express.md)

### 5.4 Environment variables (.env)

This plugin **does not read env vars by itself**. It is recommended to resolve them in the host infrastructure:

```ts
const mongoUrl = process.env.LOGGER_MONGO_DB_URL;
const dbName = process.env.LOGGER_MONGO_DB_NAME;
const collectionName = process.env.LOGGER_MONGO_COLLECTION_NAME;
```

➡️ Full configuration: [docs/configuration.md](./docs/en/configuration.md)

### 5.5 Helpers / relevant features

- **ensureIndexes**: create/verify indexes (if enabled)
- **retentionDays**: retention (TTL) depending on schema service implementation
- **extraIndexes**: additional indexes (for example `{ key: { level: 1, source: 1 } }`)

---

## ✅ Checklist

- [ ] Install `@jmlq/logger` + `@jmlq/logger-plugin-mongo` + `mongodb`
- [ ] Create `IMongoQueryClient` using `MongoClient`
- [ ] Create datasource with `createMongoDatasource(options)`
- [ ] Integrate with `createLogger({ datasources: [...] })`
- [ ] Configure indexes/retention (optional)
- [ ] Integrate in Express (`req.logger` middleware) (optional)

---

## 📌 Menu

- [Architecture](./docs/en/architecture.md)
- [Configuration](./docs/en/configuration.md)
- [Express Integration](./docs/en/integration-express.md)
- [Troubleshooting](./docs/en/troubleshooting.md)

## 🔗 References

- [`@jmlq/logger`](https://github.com/MLahuasi/jmlq-logger#readme)
- Related ecosystem plugins:
  - [`@jmlq/logger-plugin-fs`](https://github.com/MLahuasi/jmlq-logger-plugin-fs#readme)
  - [`@jmlq/logger-plugin-postgresql`](https://github.com/MLahuasi/jmlq-logger-plugin-postgresql#readme)

## ⬅️ 🌐 Ecosystem

- [`@jmlq`](https://github.com/MLahuasi/jmlq-ecosystem#readme)
