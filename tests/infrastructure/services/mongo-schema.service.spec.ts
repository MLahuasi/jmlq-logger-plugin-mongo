import {
  ensureMongoSchema,
  bootstrapMongoCollectionAndIndexes,
  createMongoInfra,
  pruneMongoOlderThan,
} from "../../../src/infrastructure/services";

import type { MongoIndexInfo } from "../../../src/domain/ports";
import type { ExtraIndexConfig } from "../../../src/infrastructure/types";

import { makeMongoQueryClientMock } from "../../mocks/mongo";

describe("Mongo services: ensureMongoSchema / bootstrapMongoCollectionAndIndexes / createMongoInfra / pruneMongoOlderThan", () => {
  const dbName = "test-db";
  const collectionName = "logs";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // ensureMongoSchema
  // -------------------------------------------------------------------------
  describe("ensureMongoSchema", () => {
    it("debería crear el índice compuesto base {level, timestamp} con name idx_level_ts", async () => {
      const client = makeMongoQueryClientMock();
      client.listIndexes.mockResolvedValue([] as MongoIndexInfo[]);

      await ensureMongoSchema({
        client,
        dbName,
        collectionName,
        retentionDays: null,
        extraIndexes: [],
      });

      expect(client.createIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        { level: 1, timestamp: 1 },
        { name: "idx_level_ts" }
      );
    });

    it("debería re-crear el índice {timestamp: 1} con TTL si retentionDays > 0 (y dropear el existente si era sólo timestamp)", async () => {
      const client = makeMongoQueryClientMock();

      const existing: MongoIndexInfo[] = [
        { name: "idx_ts_old", key: { timestamp: 1 } },
        { name: "other_idx", key: { level: 1 } },
      ];
      client.listIndexes.mockResolvedValue(existing);

      await ensureMongoSchema({
        client,
        dbName,
        collectionName,
        retentionDays: 2, // 2 días
        extraIndexes: [],
      });

      // Debe dropear el índice existente "sólo timestamp"
      expect(client.dropIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        "idx_ts_old"
      );

      // TTL = ceil(2 * 86400) = 172800
      expect(client.createIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        { timestamp: 1 },
        { name: "idx_ts_ttl", expireAfterSeconds: 172800 }
      );
    });

    it("debería crear el índice {timestamp: 1} sin TTL si retentionDays es null/0/<=0 (y dropear el existente si era sólo timestamp)", async () => {
      const client = makeMongoQueryClientMock();

      const existing: MongoIndexInfo[] = [
        { name: "idx_ts_old", key: { timestamp: 1 } },
      ];
      client.listIndexes.mockResolvedValue(existing);

      await ensureMongoSchema({
        client,
        dbName,
        collectionName,
        retentionDays: null, // no TTL
        extraIndexes: [],
      });

      expect(client.dropIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        "idx_ts_old"
      );
      expect(client.createIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        { timestamp: 1 },
        { name: "idx_ts" }
      );
    });

    it("NO debería dropear nada si no existe un índice 'sólo timestamp'", async () => {
      const client = makeMongoQueryClientMock();

      const existing: MongoIndexInfo[] = [
        { name: "compound", key: { timestamp: 1, level: 1 } }, // no es 'sólo timestamp'
      ];
      client.listIndexes.mockResolvedValue(existing);

      await ensureMongoSchema({
        client,
        dbName,
        collectionName,
        retentionDays: 1,
        extraIndexes: [],
      });

      expect(client.dropIndex).not.toHaveBeenCalled();
    });

    it("debería crear índices extra respetando name y unique", async () => {
      const client = makeMongoQueryClientMock();
      client.listIndexes.mockResolvedValue([] as MongoIndexInfo[]);

      const extraIndexes: ExtraIndexConfig[] = [
        { name: "idx_source", key: { source: 1 } },
        { name: "idx_trace_unique", key: { traceId: 1 }, unique: true },
      ];

      await ensureMongoSchema({
        client,
        dbName,
        collectionName,
        retentionDays: null,
        extraIndexes,
      });

      expect(client.createIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        { source: 1 },
        { name: "idx_source", unique: false }
      );

      expect(client.createIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        { traceId: 1 },
        { name: "idx_trace_unique", unique: true }
      );
    });
  });

  // -------------------------------------------------------------------------
  // bootstrapMongoCollectionAndIndexes
  // -------------------------------------------------------------------------
  describe("bootstrapMongoCollectionAndIndexes", () => {
    it("debería crear la colección si no existe y createIfMissing=true", async () => {
      const client = makeMongoQueryClientMock();
      client.hasCollection.mockResolvedValue(false);
      client.listIndexes.mockResolvedValue([] as MongoIndexInfo[]);

      await bootstrapMongoCollectionAndIndexes({
        client,
        dbName,
        collectionName,
        createIfMissing: true,
        ensureIndexes: false, // aquí solo probamos colección
        retentionDays: null,
        extraIndexes: [],
      });

      expect(client.createCollection).toHaveBeenCalledWith(
        dbName,
        collectionName
      );
    });

    it("debería lanzar error si no existe y createIfMissing=false", async () => {
      const client = makeMongoQueryClientMock();
      client.hasCollection.mockResolvedValue(false);

      await expect(
        bootstrapMongoCollectionAndIndexes({
          client,
          dbName,
          collectionName,
          createIfMissing: false,
          ensureIndexes: false,
          retentionDays: null,
          extraIndexes: [],
        })
      ).rejects.toThrow(
        `Mongo collection "${collectionName}" does not exist and createIfMissing=false`
      );

      expect(client.createCollection).not.toHaveBeenCalled();
    });

    it("si ensureIndexes=true debería ejecutar ensureMongoSchema (creación de índices)", async () => {
      const client = makeMongoQueryClientMock();
      client.hasCollection.mockResolvedValue(true);
      client.listIndexes.mockResolvedValue([] as MongoIndexInfo[]);

      await bootstrapMongoCollectionAndIndexes({
        client,
        dbName,
        collectionName,
        createIfMissing: true,
        ensureIndexes: true,
        retentionDays: null,
        extraIndexes: [],
      });

      // señal de que ensureMongoSchema corrió: createIndex base
      expect(client.createIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        { level: 1, timestamp: 1 },
        { name: "idx_level_ts" }
      );
    });

    it("si ensureIndexes=false NO debería crear índices", async () => {
      const client = makeMongoQueryClientMock();
      client.hasCollection.mockResolvedValue(true);

      await bootstrapMongoCollectionAndIndexes({
        client,
        dbName,
        collectionName,
        createIfMissing: true,
        ensureIndexes: false,
        retentionDays: 10,
        extraIndexes: [{ name: "idx_x", key: { x: 1 } }],
      });

      expect(client.createIndex).not.toHaveBeenCalled();
      expect(client.listIndexes).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // createMongoInfra
  // -------------------------------------------------------------------------
  describe("createMongoInfra", () => {
    it("debería conectar, bootstrappear y retornar infra con dispose() que cierra el cliente", async () => {
      const client = makeMongoQueryClientMock();
      client.hasCollection.mockResolvedValue(true);
      client.listIndexes.mockResolvedValue([] as MongoIndexInfo[]);

      const infra = await createMongoInfra(client, {
        dbName,
        collectionName,
        createIfMissing: true,
        ensureIndexes: true,
        retentionDays: null,
        extraIndexes: [],
      });

      expect(client.connect).toHaveBeenCalledTimes(1);

      // bootstrap -> ensureMongoSchema -> createIndex base
      expect(client.createIndex).toHaveBeenCalledWith(
        dbName,
        collectionName,
        { level: 1, timestamp: 1 },
        { name: "idx_level_ts" }
      );

      expect(infra.dbName).toBe(dbName);
      expect(infra.collectionName).toBe(collectionName);

      await infra.dispose();
      expect(client.close).toHaveBeenCalledTimes(1);
    });

    it("debería aplicar defaults del cfg (collectionName='logs', createIfMissing=true, ensureIndexes=true, etc.)", async () => {
      const client = makeMongoQueryClientMock();
      client.hasCollection.mockResolvedValue(true);
      client.listIndexes.mockResolvedValue([] as MongoIndexInfo[]);

      const infra = await createMongoInfra(client, { dbName });

      expect(infra.collectionName).toBe("logs");
      expect(client.connect).toHaveBeenCalledTimes(1);

      // ensureIndexes default true => createIndex base
      expect(client.createIndex).toHaveBeenCalledWith(
        dbName,
        "logs",
        { level: 1, timestamp: 1 },
        { name: "idx_level_ts" }
      );
    });
  });

  // -------------------------------------------------------------------------
  // pruneMongoOlderThan
  // -------------------------------------------------------------------------
  describe("pruneMongoOlderThan", () => {
    it("debería eliminar por cutoff (timestamp < ahora - días) y retornar deletedCount", async () => {
      const client = makeMongoQueryClientMock();

      const now = 1_700_000_000_000;
      jest.spyOn(Date, "now").mockReturnValue(now);

      client.deleteMany.mockResolvedValue({ deletedCount: 7 });

      const days = 3;
      const result = await pruneMongoOlderThan(
        client,
        dbName,
        collectionName,
        days
      );

      const cutoff = now - days * 24 * 60 * 60 * 1000;

      expect(client.deleteMany).toHaveBeenCalledWith(dbName, collectionName, {
        timestamp: { $lt: cutoff },
      });

      expect(result).toBe(7);
    });

    it("si deletedCount viene undefined debería retornar 0", async () => {
      const client = makeMongoQueryClientMock();
      client.deleteMany.mockResolvedValue({});

      const result = await pruneMongoOlderThan(
        client,
        dbName,
        collectionName,
        1
      );
      expect(result).toBe(0);
    });
  });
});
