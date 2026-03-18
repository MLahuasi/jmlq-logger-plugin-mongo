import { MongoLogsRepository } from "../../../src/infrastructure/repositories";

import type { LogEntry } from "../../../src/domain/model";
import type { LogFilterRequest } from "../../../src/domain/request";
import type { ILogResponse } from "../../../src/domain/response";

import { makeMongoQueryClientMock } from "../../mocks/mongo";

describe("MongoLogsRepository", () => {
  const dbName = "test-db";
  const collection = "logs";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // healthcheck
  // -------------------------------------------------------------------------
  describe("healthcheck()", () => {
    it("debería ejecutar una búsqueda mínima (limit 1) para validar conexión/colección", async () => {
      const client = makeMongoQueryClientMock();
      client.find.mockResolvedValue({ documents: [] });

      const repo = new MongoLogsRepository(client, dbName, collection);

      await expect(repo.healthcheck()).resolves.toBeUndefined();

      expect(client.find).toHaveBeenCalledWith(
        dbName,
        collection,
        {},
        { limit: 1 }
      );
    });
  });

  // -------------------------------------------------------------------------
  // insert
  // -------------------------------------------------------------------------
  describe("insert()", () => {
    it("debería mapear LogEntry a documento Mongo y usar null en campos opcionales faltantes", async () => {
      const client = makeMongoQueryClientMock();
      client.insertOne.mockResolvedValue(undefined as any);

      const repo = new MongoLogsRepository(client, dbName, collection);

      const log: LogEntry = {
        source: undefined,
        timestamp: 1700000000000,
        level: 2,
        message: "hello",
        meta: undefined,
      } as any;

      await expect(repo.insert(log)).resolves.toBeUndefined();

      expect(client.insertOne).toHaveBeenCalledWith(dbName, collection, {
        source: null,
        timestamp: 1700000000000,
        level: 2,
        message: "hello",
        meta: null,
      });
    });

    it("debería enviar source/meta cuando existan", async () => {
      const client = makeMongoQueryClientMock();
      client.insertOne.mockResolvedValue(undefined as any);

      const repo = new MongoLogsRepository(client, dbName, collection);

      const log: LogEntry = {
        source: "api",
        timestamp: 1700000000001,
        level: 1,
        message: "ok",
        meta: { userId: "123" },
      } as any;

      await repo.insert(log);

      expect(client.insertOne).toHaveBeenCalledWith(dbName, collection, {
        source: "api",
        timestamp: 1700000000001,
        level: 1,
        message: "ok",
        meta: { userId: "123" },
      });
    });
  });

  // -------------------------------------------------------------------------
  // find
  // -------------------------------------------------------------------------
  describe("find()", () => {
    it("debería construir query vacío + sort ASC por timestamp por defecto y devolver en DESC (reverse en memoria)", async () => {
      const client = makeMongoQueryClientMock();

      const docs: ILogResponse[] = [
        { timestamp: 1, level: 1, message: "a" } as any,
        { timestamp: 2, level: 1, message: "b" } as any,
        { timestamp: 3, level: 1, message: "c" } as any,
      ];

      client.find.mockResolvedValue({ documents: docs });

      const repo = new MongoLogsRepository(client, dbName, collection);

      const res = await repo.find({} as LogFilterRequest);

      expect(client.find).toHaveBeenCalledWith(
        dbName,
        collection,
        {},
        { sort: { timestamp: 1 } }
      );

      // reverse
      expect(res.map((x) => x.timestamp)).toEqual([3, 2, 1]);
    });

    it("debería aplicar filtros levelMin, since, until y query (regex i)", async () => {
      const client = makeMongoQueryClientMock();
      client.find.mockResolvedValue({ documents: [] });

      const repo = new MongoLogsRepository(client, dbName, collection);

      const filter: LogFilterRequest = {
        levelMin: 2,
        since: 100,
        until: 200,
        query: "  error  ",
      } as any;

      await repo.find(filter);

      expect(client.find).toHaveBeenCalledWith(
        dbName,
        collection,
        {
          level: { $gte: 2 },
          timestamp: { $gte: 100, $lte: 200 },
          message: { $regex: "error", $options: "i" },
        },
        { sort: { timestamp: 1 } }
      );
    });

    it("si query está vacío o espacios, NO debería agregar filtro message", async () => {
      const client = makeMongoQueryClientMock();
      client.find.mockResolvedValue({ documents: [] });

      const repo = new MongoLogsRepository(client, dbName, collection);

      await repo.find({ query: "   " } as any);

      const [, , queryArg] = client.find.mock.calls[0]; // (db, collection, query, options)
      expect(queryArg).toEqual({});
    });

    it("con limit sin offset, debería usar limit y NO usar skip", async () => {
      const client = makeMongoQueryClientMock();
      client.find.mockResolvedValue({ documents: [] });

      const repo = new MongoLogsRepository(client, dbName, collection);

      await repo.find({ limit: 10 } as any);

      expect(client.find).toHaveBeenCalledWith(
        dbName,
        collection,
        {},
        { sort: { timestamp: 1 }, limit: 10 }
      );
    });

    it("con limit y offset (página) debería usar skip = offset * limit", async () => {
      const client = makeMongoQueryClientMock();
      client.find.mockResolvedValue({ documents: [] });

      const repo = new MongoLogsRepository(client, dbName, collection);

      await repo.find({ limit: 10, offset: 2 } as any);

      expect(client.find).toHaveBeenCalledWith(
        dbName,
        collection,
        {},
        { sort: { timestamp: 1 }, limit: 10, skip: 20 }
      );
    });

    it("sin limit pero con offset, debería usar skip = offset directamente", async () => {
      const client = makeMongoQueryClientMock();
      client.find.mockResolvedValue({ documents: [] });

      const repo = new MongoLogsRepository(client, dbName, collection);

      await repo.find({ offset: 15 } as any);

      expect(client.find).toHaveBeenCalledWith(
        dbName,
        collection,
        {},
        { sort: { timestamp: 1 }, skip: 15 }
      );
    });

    it("si client.find retorna documents undefined, debería devolver []", async () => {
      const client = makeMongoQueryClientMock();
      client.find.mockResolvedValue({ documents: undefined });

      const repo = new MongoLogsRepository(client, dbName, collection);

      await expect(repo.find({} as any)).resolves.toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // pruneOlderThan
  // -------------------------------------------------------------------------
  describe("pruneOlderThan()", () => {
    it("debería borrar por cutoff (timestamp < ahora - días) y retornar deletedCount", async () => {
      const client = makeMongoQueryClientMock();

      const now = 1_700_000_000_000;
      jest.spyOn(Date, "now").mockReturnValue(now);

      client.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const repo = new MongoLogsRepository(client, dbName, collection);

      const days = 3;
      const res = await repo.pruneOlderThan(days);

      const cutoff = now - days * 24 * 60 * 60 * 1000;

      expect(client.deleteMany).toHaveBeenCalledWith(dbName, collection, {
        timestamp: { $lt: cutoff },
      });

      expect(res).toBe(5);
    });

    it("si deletedCount viene undefined, debería retornar 0", async () => {
      const client = makeMongoQueryClientMock();
      client.deleteMany.mockResolvedValue({});

      const repo = new MongoLogsRepository(client, dbName, collection);

      await expect(repo.pruneOlderThan(1)).resolves.toBe(0);
    });
  });
});
