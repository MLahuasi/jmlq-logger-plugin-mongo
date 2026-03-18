import type { IMongoLogsRepository } from "../../../src/domain/ports";

export function makeMongoLogsRepositoryMock(): jest.Mocked<IMongoLogsRepository> {
  return {
    healthcheck: jest.fn(),
    insert: jest.fn(),
    find: jest.fn(),
    pruneOlderThan: jest.fn(),
  } as unknown as jest.Mocked<IMongoLogsRepository>;
}
