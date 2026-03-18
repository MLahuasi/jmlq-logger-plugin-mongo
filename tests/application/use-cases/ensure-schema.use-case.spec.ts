// tests/application/use-cases/ensure-schema.usecase.spec.ts
import { EnsureSchemaUseCase } from "../../../src/application/use-cases";

import type { ExtraIndexConfig } from "../../../src/infrastructure/types";

import { makeMongoQueryClientMock } from "../../mocks/mongo/mongo-query-client.mock";

// Mock del módulo de services para interceptar la llamada
jest.mock("../../../src/infrastructure/services", () => ({
  bootstrapMongoCollectionAndIndexes: jest.fn(),
}));

import { bootstrapMongoCollectionAndIndexes } from "../../../src/infrastructure/services";

describe("EnsureSchemaUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("debería delegar a bootstrapMongoCollectionAndIndexes con los parámetros configurados", async () => {
    const client = makeMongoQueryClientMock();

    (bootstrapMongoCollectionAndIndexes as jest.Mock).mockResolvedValue(
      undefined
    );

    const dbName = "test-db";
    const collectionName = "logs";
    const createIfMissing = true;
    const ensureIndexes = true;
    const retentionDays = 7;

    const extraIndexes: ExtraIndexConfig[] = [
      { name: "idx_source", key: { source: 1 } },
      { name: "idx_trace_unique", key: { traceId: 1 }, unique: true },
    ];

    const uc = new EnsureSchemaUseCase(
      client,
      dbName,
      collectionName,
      createIfMissing,
      ensureIndexes,
      retentionDays,
      extraIndexes
    );

    await expect(uc.execute()).resolves.toBeUndefined();

    expect(bootstrapMongoCollectionAndIndexes).toHaveBeenCalledTimes(1);
    expect(bootstrapMongoCollectionAndIndexes).toHaveBeenCalledWith({
      client,
      dbName,
      collectionName,
      createIfMissing,
      ensureIndexes,
      retentionDays,
      extraIndexes,
    });
  });

  it("debería permitir retentionDays=null y extraIndexes=[] sin alterar el payload", async () => {
    const client = makeMongoQueryClientMock();

    (bootstrapMongoCollectionAndIndexes as jest.Mock).mockResolvedValue(
      undefined
    );

    const uc = new EnsureSchemaUseCase(
      client,
      "db",
      "logs",
      false,
      false,
      null,
      []
    );

    await uc.execute();

    expect(bootstrapMongoCollectionAndIndexes).toHaveBeenCalledWith({
      client,
      dbName: "db",
      collectionName: "logs",
      createIfMissing: false,
      ensureIndexes: false,
      retentionDays: null,
      extraIndexes: [],
    });
  });
});
