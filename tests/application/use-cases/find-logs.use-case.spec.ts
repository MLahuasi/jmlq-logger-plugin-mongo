// tests/application/use-cases/find-logs.usecase.spec.ts
import { FindLogsUseCase } from "../../../src/application/use-cases";
import { makeMongoLogsRepositoryMock } from "../../mocks/repositories/mongo-logs-repository.mock";

import type { ILogResponse } from "../../../src/domain/response";
import type { LogFilterRequest } from "../../../src/domain/request";

describe("FindLogsUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("debería delegar directamente a repo.find(filter) y retornar su resultado", async () => {
    const repo = makeMongoLogsRepositoryMock();
    const uc = new FindLogsUseCase(repo);

    const logs: ILogResponse[] = [
      { timestamp: 1, level: 1, message: "a" } as any,
      { timestamp: 2, level: 2, message: "b" } as any,
    ];

    repo.find.mockResolvedValue(logs);

    const filter: LogFilterRequest = { limit: 10 } as any;

    const result = await uc.execute(filter);

    expect(repo.find).toHaveBeenCalledTimes(1);
    expect(repo.find).toHaveBeenCalledWith(filter);
    expect(result).toBe(logs);
  });

  it("si filter es null/undefined, debería delegar con {}", async () => {
    const repo = makeMongoLogsRepositoryMock();
    const uc = new FindLogsUseCase(repo);

    repo.find.mockResolvedValue([]);

    await uc.execute(undefined as any);
    expect(repo.find).toHaveBeenCalledWith({});

    jest.clearAllMocks();

    await uc.execute(null as any);
    expect(repo.find).toHaveBeenCalledWith({});
  });

  it("debería retornar un array vacío si el repositorio retorna []", async () => {
    const repo = makeMongoLogsRepositoryMock();
    const uc = new FindLogsUseCase(repo);

    repo.find.mockResolvedValue([]);

    const result = await uc.execute({} as any);

    expect(result).toEqual([]);
  });
});
