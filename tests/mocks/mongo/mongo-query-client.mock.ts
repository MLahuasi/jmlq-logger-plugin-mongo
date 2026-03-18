import type { IMongoQueryClient } from "../../../src/domain/ports";

type FindResult<T> = { documents?: T[] };
type DeleteManyResult = { deletedCount?: number };

export function makeMongoQueryClientMock(): jest.Mocked<IMongoQueryClient> {
  return {
    connect: jest.fn(),
    close: jest.fn(),

    hasCollection: jest.fn(),
    createCollection: jest.fn(),

    createIndex: jest.fn(),
    listIndexes: jest.fn(),
    dropIndex: jest.fn(),

    // repository methods:
    find: jest.fn<Promise<FindResult<any>>, any>(),
    insertOne: jest.fn(),
    deleteMany: jest.fn<Promise<DeleteManyResult>, any>(),
  } as unknown as jest.Mocked<IMongoQueryClient>;
}
