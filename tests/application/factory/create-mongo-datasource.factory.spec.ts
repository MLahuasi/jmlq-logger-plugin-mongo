import type { IMongoDatasourceOptions } from "../../../src/application/types";

import { makeMongoLogsRepositoryMock } from "../../mocks/repositories";
import {
  makeSaveLogUseCaseMock,
  makeFindLogsUseCaseMock,
  makeEnsureSchemaUseCaseMock,
  makePruneLogsUseCaseMock,
} from "../../mocks/use-cases";

describe("createMongoDatasource (runtime mocks, sin TDZ)", () => {
  const client = { any: "client" } as any;

  async function setup() {
    // 1) reset para que el import vea los doMock de este test
    jest.resetModules();
    jest.clearAllMocks();

    // 2) “constructores” mockeados (new-able) en runtime
    const MongoLogsRepository = jest.fn();
    const MongoDatasourceAdapter = jest.fn();

    const SaveLogUseCase = jest.fn();
    const FindLogsUseCase = jest.fn();
    const EnsureSchemaUseCase = jest.fn();
    const PruneLogsUseCase = jest.fn();

    // 3) mockear las rutas EXACTAS que usa el factory
    //    (ajusta estas rutas si tu factory importa desde otros paths)
    jest.doMock(
      "../../../src/infrastructure/repositories/mongo-logs.repository",
      () => ({
        MongoLogsRepository,
      })
    );

    jest.doMock("../../../src/infrastructure/adapters", () => ({
      MongoDatasourceAdapter,
    }));

    jest.doMock("../../../src/application/use-cases", () => ({
      SaveLogUseCase,
      FindLogsUseCase,
      EnsureSchemaUseCase,
      PruneLogsUseCase,
    }));

    // 4) importar DESPUÉS del doMock
    const { createMongoDatasource } = await import(
      "../../../src/application/factory"
    );

    return {
      createMongoDatasource,
      ctors: {
        MongoLogsRepository,
        MongoDatasourceAdapter,
        SaveLogUseCase,
        FindLogsUseCase,
        EnsureSchemaUseCase,
        PruneLogsUseCase,
      },
    };
  }

  it("usa defaults + ejecuta ensureSchema", async () => {
    const { createMongoDatasource, ctors } = await setup();

    const repo = makeMongoLogsRepositoryMock();
    const ensureUC = makeEnsureSchemaUseCaseMock();
    const saveUC = makeSaveLogUseCaseMock();
    const findUC = makeFindLogsUseCaseMock();

    ctors.MongoLogsRepository.mockReturnValue(repo);
    ctors.EnsureSchemaUseCase.mockReturnValue(ensureUC);
    ctors.SaveLogUseCase.mockReturnValue(saveUC);
    ctors.FindLogsUseCase.mockReturnValue(findUC);

    const adapterInstance = { name: "mongo" };
    ctors.MongoDatasourceAdapter.mockReturnValue(adapterInstance);

    ensureUC.execute.mockResolvedValue(undefined);

    const opts: IMongoDatasourceOptions = {
      client,
      dbName: "db",
    } as any;

    const ds = await createMongoDatasource(opts);

    expect(ctors.MongoLogsRepository).toHaveBeenCalledWith(
      client,
      "db",
      "logs"
    );

    expect(ctors.EnsureSchemaUseCase).toHaveBeenCalledWith(
      client,
      "db",
      "logs",
      true,
      true,
      null,
      []
    );
    expect(ensureUC.execute).toHaveBeenCalledTimes(1);

    expect(ctors.SaveLogUseCase).toHaveBeenCalledWith(repo);
    expect(ctors.FindLogsUseCase).toHaveBeenCalledWith(repo);

    expect(ctors.MongoDatasourceAdapter).toHaveBeenCalledWith(
      saveUC,
      findUC,
      ensureUC,
      undefined
    );

    expect(ds).toBe(adapterInstance);
  });

  it("si createIfMissing=false y ensureIndexes=false no crea EnsureSchemaUseCase", async () => {
    const { createMongoDatasource, ctors } = await setup();

    const repo = makeMongoLogsRepositoryMock();
    const saveUC = makeSaveLogUseCaseMock();
    const findUC = makeFindLogsUseCaseMock();

    ctors.MongoLogsRepository.mockReturnValue(repo);
    ctors.SaveLogUseCase.mockReturnValue(saveUC);
    ctors.FindLogsUseCase.mockReturnValue(findUC);

    const adapterInstance = { name: "mongo" };
    ctors.MongoDatasourceAdapter.mockReturnValue(adapterInstance);

    const opts: IMongoDatasourceOptions = {
      client,
      dbName: "db",
      collectionName: "c",
      createIfMissing: false,
      ensureIndexes: false,
    } as any;

    const ds = await createMongoDatasource(opts);

    expect(ctors.EnsureSchemaUseCase).not.toHaveBeenCalled();

    expect(ctors.MongoDatasourceAdapter).toHaveBeenCalledWith(
      saveUC,
      findUC,
      undefined,
      undefined
    );

    expect(ds).toBe(adapterInstance);
  });

  it("si enablePrune=true crea PruneLogsUseCase y lo pasa al adapter", async () => {
    const { createMongoDatasource, ctors } = await setup();

    const repo = makeMongoLogsRepositoryMock();
    const ensureUC = makeEnsureSchemaUseCaseMock();
    const saveUC = makeSaveLogUseCaseMock();
    const findUC = makeFindLogsUseCaseMock();
    const pruneUC = makePruneLogsUseCaseMock();

    ctors.MongoLogsRepository.mockReturnValue(repo);
    ctors.EnsureSchemaUseCase.mockReturnValue(ensureUC);
    ctors.SaveLogUseCase.mockReturnValue(saveUC);
    ctors.FindLogsUseCase.mockReturnValue(findUC);
    ctors.PruneLogsUseCase.mockReturnValue(pruneUC);

    ensureUC.execute.mockResolvedValue(undefined);

    const adapterInstance = { name: "mongo" };
    ctors.MongoDatasourceAdapter.mockReturnValue(adapterInstance);

    const ds = await createMongoDatasource({
      client,
      dbName: "db",
      enablePrune: true,
    } as any);

    expect(ctors.PruneLogsUseCase).toHaveBeenCalledWith(repo);

    expect(ctors.MongoDatasourceAdapter).toHaveBeenCalledWith(
      saveUC,
      findUC,
      ensureUC,
      pruneUC
    );

    expect(ds).toBe(adapterInstance);
  });
});
