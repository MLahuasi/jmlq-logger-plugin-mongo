import type { LogFilterRequest } from "../../domain/request";
import type { ILogResponse } from "../../domain/response";
import type { IMongoLogsRepository } from "../../domain/ports";

/**
 * Caso de uso: búsqueda de logs en Mongo.
 *
 * - Delegación directa al repositorio
 * - Sin lógica adicional
 * - Simétrico a FindLogsUseCase de Postgres
 */
export class FindLogsUseCase {
  constructor(private readonly repo: IMongoLogsRepository) {}

  async execute(filter: LogFilterRequest): Promise<ILogResponse[]> {
    return this.repo.find(filter ?? {});
  }
}
