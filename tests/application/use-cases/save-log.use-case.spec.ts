// tests/application/use-cases/save-log.usecase.spec.ts
import { SaveLogUseCase } from "../../../src/application/use-cases";
import { makeMongoLogsRepositoryMock } from "../../mocks/repositories/mongo-logs-repository.mock";

describe("SaveLogUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("debería NO hacer nada si req es undefined/null", async () => {
    const repo = makeMongoLogsRepositoryMock();
    const uc = new SaveLogUseCase(repo);

    await expect(uc.execute(undefined as any)).resolves.toBeUndefined();
    await expect(uc.execute(null as any)).resolves.toBeUndefined();

    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("debería NO hacer nada si req.log no existe", async () => {
    const repo = makeMongoLogsRepositoryMock();
    const uc = new SaveLogUseCase(repo);

    await expect(uc.execute({} as any)).resolves.toBeUndefined();
    await expect(
      uc.execute({ log: undefined } as any)
    ).resolves.toBeUndefined();

    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("debería llamar repo.insert(log) cuando req.log existe", async () => {
    const repo = makeMongoLogsRepositoryMock();
    repo.insert.mockResolvedValue(undefined);

    const uc = new SaveLogUseCase(repo);

    const log = {
      source: "api",
      level: 2,
      message: "hello",
      timestamp: 1700000000000,
      meta: { userId: "123" },
    } as any;

    await expect(uc.execute({ log })).resolves.toBeUndefined();

    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert).toHaveBeenCalledWith(log);
  });
});
