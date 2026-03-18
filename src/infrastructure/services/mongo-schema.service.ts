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
    await client.createIndex(
      dbName,
      collectionName,
      { timestamp: 1 },
      { name: "idx_ts_ttl", expireAfterSeconds }
    );
  } else {
    await client.createIndex(
      dbName,
      collectionName,
      { timestamp: 1 },
      { name: "idx_ts" }
    );
  }

  // 3) Índices extra
  for (const idx of extraIndexes) {
    await client.createIndex(dbName, collectionName, idx.key, {
      name: idx.name,
      unique: !!idx.unique,
    });
  }
}

function findOnlyTimestampIndex(
  indexes: MongoIndexInfo[]
): MongoIndexInfo | null {
  for (const i of indexes ?? []) {
    const keys = Object.keys(i.key ?? {});
    if (keys.length === 1 && keys[0] === "timestamp") return i;
  }
  return null;
}

/**
 * bootstrapMongoCollectionAndIndexes
 * -----------------------------------------------------------------------------
 * Bootstrap SIN connect/close.
 * Úsalo cuando el host controla lifecycle del cliente.
 */
export async function bootstrapMongoCollectionAndIndexes(opts: {
  client: IMongoQueryClient;
  dbName: string;
  collectionName: string;
  createIfMissing: boolean;
  ensureIndexes: boolean;
  retentionDays: number | null;
  extraIndexes: ExtraIndexConfig[];
}): Promise<void> {
  const {
    client,
    dbName,
    collectionName,
    createIfMissing,
    ensureIndexes,
    retentionDays,
    extraIndexes,
  } = opts;

  await ensureMongoCollectionIfNeeded({
    client,
    dbName,
    collectionName,
    createIfMissing,
  });

  if (ensureIndexes) {
    await ensureMongoSchema({
      client,
      dbName,
      collectionName,
      retentionDays,
      extraIndexes,
    });
  }
}

/**
 * createMongoInfra
 * -----------------------------------------------------------------------------
 * Infra completa CON connect/close (útil para examples/CLI).
 * Reutiliza el bootstrap para evitar duplicación.
 */
export async function createMongoInfra(
  client: IMongoQueryClient,
  cfg: MongoPluginConfig
): Promise<MongoInfra> {
  const {
    dbName,
    collectionName = "logs",
    createIfMissing = true,
    ensureIndexes = true,
    retentionDays = null,
    extraIndexes = [],
  } = cfg;

  await client.connect();

  await bootstrapMongoCollectionAndIndexes({
    client,
    dbName,
    collectionName,
    createIfMissing,
    ensureIndexes,
    retentionDays,
    extraIndexes,
  });

  return {
    client,
    dbName,
    collectionName,
    async dispose() {
      await client.close();
    },
  };
}

/**
 * pruneMongoOlderThan
 * -----------------------------------------------------------------------------
 * Elimina documentos con timestamp < ahora - días.
 * Retorna la cantidad eliminada.
 */
export async function pruneMongoOlderThan(
  client: IMongoQueryClient,
  dbName: string,
  collectionName: string,
  days: number
): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const res = await client.deleteMany(dbName, collectionName, {
    timestamp: { $lt: cutoff },
  });

  return res.deletedCount ?? 0;
}
