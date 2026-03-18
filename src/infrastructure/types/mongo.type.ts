import type { MongoIndexKey, IMongoQueryClient } from "../../domain/ports";

export interface ExtraIndexConfig {
  key: MongoIndexKey;
  unique?: boolean;
  name?: string;
}

export interface MongoPluginConfig {
  dbName: string;
  collectionName?: string;

  createIfMissing?: boolean;
  ensureIndexes?: boolean;
  /**
   * Si > 0, se crea índice TTL sobre `timestamp`
   * con expireAfterSeconds = retentionDays * 86400
   */
  retentionDays?: number | null;
  extraIndexes?: ExtraIndexConfig[];
}

export interface MongoInfra {
  client: IMongoQueryClient;
  dbName: string;
  collectionName: string;
  dispose(): Promise<void>;
}
