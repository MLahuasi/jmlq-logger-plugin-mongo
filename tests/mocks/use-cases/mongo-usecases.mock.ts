// tests/mocks/use-cases/mongo-usecases.mock.ts
import type {
  SaveLogUseCase,
  FindLogsUseCase,
  EnsureSchemaUseCase,
  PruneLogsUseCase,
} from "../../../src/application/use-cases";

type ExecFn = (...args: any[]) => any;

export function makeSaveLogUseCaseMock(): jest.Mocked<SaveLogUseCase> {
  return { execute: jest.fn<ReturnType<ExecFn>, Parameters<ExecFn>>() } as any;
}

export function makeFindLogsUseCaseMock(): jest.Mocked<FindLogsUseCase> {
  return { execute: jest.fn<ReturnType<ExecFn>, Parameters<ExecFn>>() } as any;
}

export function makeEnsureSchemaUseCaseMock(): jest.Mocked<EnsureSchemaUseCase> {
  return { execute: jest.fn<ReturnType<ExecFn>, Parameters<ExecFn>>() } as any;
}

export function makePruneLogsUseCaseMock(): jest.Mocked<PruneLogsUseCase> {
  return { execute: jest.fn<ReturnType<ExecFn>, Parameters<ExecFn>>() } as any;
}
