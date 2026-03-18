// tests/infrastructure/adapters/mongo.datasource.adapter.spec.ts
import { MongoDatasourceAdapter } from "../../../src/infrastructure/adapters";

import type {
  LogEntry as CoreLogEntry,
  LogSearchRequest,
  LogRecord,
} from "@jmlq/logger";

import {
  makeSaveLogUseCaseMock,
  makeFindLogsUseCaseMock,
  makeEnsureSchemaUseCaseMock,
  makePruneLogsUseCaseMock,
} from "../../mocks/use-cases/mongo-usecases.mock";

describe("MongoDatasourceAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("name debería ser 'mongo'", () => {
    const saveUC = makeSaveLogUseCaseMock();
    const findUC = makeFindLogsUseCaseMock();

    const adapter = new MongoDatasourceAdapter(saveUC, findUC);

    expect(adapter.name).toBe("mongo");
  });

  // -------------------------------------------------------------------------
  // save
  // -------------------------------------------------------------------------
  describe("save()", () => {
    it("debería delegar a SaveLogUseCase.execute con dto { log }", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();

      saveUC.execute.mockResolvedValue(undefined);

      const adapter = new MongoDatasourceAdapter(saveUC, findUC);

      const log: CoreLogEntry = {
        source: "api",
        level: 2,
        message: "hello",
        timestamp: 1700000000000,
        meta: { userId: "1" },
      } as any;

      await expect(adapter.save(log)).resolves.toBeUndefined();

      expect(saveUC.execute).toHaveBeenCalledTimes(1);
      expect(saveUC.execute).toHaveBeenCalledWith({ log });
    });
  });

  // -------------------------------------------------------------------------
  // find
  // -------------------------------------------------------------------------
  describe("find()", () => {
    it("debería delegar a FindLogsUseCase.execute con filter (o {}) y devolver el resultado tal cual", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();

      const records: LogRecord[] = [
        { timestamp: 1, level: 1, message: "a" } as any,
        { timestamp: 2, level: 2, message: "b" } as any,
      ];

      findUC.execute.mockResolvedValue(records as any);

      const adapter = new MongoDatasourceAdapter(saveUC, findUC);

      const filter: LogSearchRequest = { limit: 10, offset: 1 } as any;

      const res = await adapter.find(filter);

      expect(findUC.execute).toHaveBeenCalledTimes(1);
      expect(findUC.execute).toHaveBeenCalledWith(filter as any);
      expect(res).toBe(records); // mismo objeto retornado
    });

    it("si no se pasa filter, debería llamar execute con {}", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();

      findUC.execute.mockResolvedValue([] as any);

      const adapter = new MongoDatasourceAdapter(saveUC, findUC);

      await adapter.find();

      expect(findUC.execute).toHaveBeenCalledTimes(1);
      expect(findUC.execute).toHaveBeenCalledWith({});
    });
  });

  // -------------------------------------------------------------------------
  // flush / dispose
  // -------------------------------------------------------------------------
  describe("flush() / dispose()", () => {
    it("flush() debería ser noop (no lanza y no llama use-cases)", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();

      const adapter = new MongoDatasourceAdapter(saveUC, findUC);

      await expect(adapter.flush()).resolves.toBeUndefined();

      expect(saveUC.execute).not.toHaveBeenCalled();
      expect(findUC.execute).not.toHaveBeenCalled();
    });

    it("dispose() debería ser noop (no lanza y no llama use-cases)", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();

      const adapter = new MongoDatasourceAdapter(saveUC, findUC);

      await expect(adapter.dispose()).resolves.toBeUndefined();

      expect(saveUC.execute).not.toHaveBeenCalled();
      expect(findUC.execute).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // ensureSchema (opcional)
  // -------------------------------------------------------------------------
  describe("ensureSchema()", () => {
    it("si NO hay EnsureSchemaUseCase inyectado, debería retornar sin hacer nada", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();

      const adapter = new MongoDatasourceAdapter(saveUC, findUC);

      await expect(adapter.ensureSchema()).resolves.toBeUndefined();
      // no explota, no llama nada adicional
    });

    it("si hay EnsureSchemaUseCase, debería llamar execute()", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();
      const ensureUC = makeEnsureSchemaUseCaseMock();

      ensureUC.execute.mockResolvedValue(undefined);

      const adapter = new MongoDatasourceAdapter(saveUC, findUC, ensureUC);

      await expect(adapter.ensureSchema()).resolves.toBeUndefined();

      expect(ensureUC.execute).toHaveBeenCalledTimes(1);
      expect(ensureUC.execute).toHaveBeenCalledWith();
    });
  });

  // -------------------------------------------------------------------------
  // pruneOlderThan (opcional)
  // -------------------------------------------------------------------------
  describe("pruneOlderThan()", () => {
    it("si NO hay PruneLogsUseCase inyectado, debería retornar 0", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();

      const adapter = new MongoDatasourceAdapter(saveUC, findUC);

      await expect(adapter.pruneOlderThan(7)).resolves.toBe(0);
    });

    it("si hay PruneLogsUseCase, debería llamar execute({days}) y retornar su resultado", async () => {
      const saveUC = makeSaveLogUseCaseMock();
      const findUC = makeFindLogsUseCaseMock();
      const ensureUC = makeEnsureSchemaUseCaseMock();
      const pruneUC = makePruneLogsUseCaseMock();

      pruneUC.execute.mockResolvedValue(123 as any);

      const adapter = new MongoDatasourceAdapter(
        saveUC,
        findUC,
        ensureUC,
        pruneUC
      );

      const res = await adapter.pruneOlderThan(30);

      expect(pruneUC.execute).toHaveBeenCalledTimes(1);
      expect(pruneUC.execute).toHaveBeenCalledWith({ days: 30 });
      expect(res).toBe(123);
    });
  });
});
