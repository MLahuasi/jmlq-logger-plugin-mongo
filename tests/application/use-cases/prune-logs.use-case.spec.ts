// tests/application/use-cases/prune-logs.usecase.spec.ts
import { PruneLogsUseCase } from "../../../src/application/use-cases/";
import { makeMongoLogsRepositoryMock } from "../../mocks/repositories/mongo-logs-repository.mock";

describe("PruneLogsUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("debería retornar 0 y NO llamar al repo si req es null/undefined", async () => {
    const repo = makeMongoLogsRepositoryMock();
    const uc = new PruneLogsUseCase(repo);

    await expect(uc.execute(undefined as any)).resolves.toBe(0);
    await expect(uc.execute(null as any)).resolves.toBe(0);

    expect(repo.pruneOlderThan).not.toHaveBeenCalled();
  });

  it("debería retornar 0 y NO llamar al repo si days no es finito (NaN, Infinity)", async () => {
    const repo = makeMongoLogsRepositoryMock();
    const uc = new PruneLogsUseCase(repo);

    await expect(uc.execute({ days: NaN } as any)).resolves.toBe(0);
    await expect(
      uc.execute({ days: Number.POSITIVE_INFINITY } as any)
    ).resolves.toBe(0);

    expect(repo.pruneOlderThan).not.toHaveBeenCalled();
  });

  it("debería retornar 0 y NO llamar al repo si days <= 0", async () => {
    const repo = makeMongoLogsRepositoryMock();
    const uc = new PruneLogsUseCase(repo);

    await expect(uc.execute({ days: 0 })).resolves.toBe(0);
    await expect(uc.execute({ days: -10 })).resolves.toBe(0);

    expect(repo.pruneOlderThan).not.toHaveBeenCalled();
  });

  it("debería normalizar days con Number() y delegar a repo.pruneOlderThan(days) si days > 0", async () => {
    const repo = makeMongoLogsRepositoryMock();
    repo.pruneOlderThan.mockResolvedValue(12);

    const uc = new PruneLogsUseCase(repo);

    // days como string (caso realista en configs/env)
    const res = await uc.execute({ days: "7" as any });

    expect(repo.pruneOlderThan).toHaveBeenCalledTimes(1);
    expect(repo.pruneOlderThan).toHaveBeenCalledWith(7);
    expect(res).toBe(12);
  });

  it("debería retornar lo que devuelva el repo", async () => {
    const repo = makeMongoLogsRepositoryMock();
    repo.pruneOlderThan.mockResolvedValue(3);

    const uc = new PruneLogsUseCase(repo);

    await expect(uc.execute({ days: 5 })).resolves.toBe(3);
  });
});
