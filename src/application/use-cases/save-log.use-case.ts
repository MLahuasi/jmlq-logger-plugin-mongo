import type { SaveLogRequest } from "../../domain/request";
import type { IMongoLogsRepository } from "../../domain/ports";

/**
 * Caso de uso: guardar un log en Mongo.
 *
 * - Orquesta el repositorio
 * - No conoce Mongo ni detalles de infraestructura
 * - Simétrico a SaveLogUseCase de Postgres
 */
export class SaveLogUseCase {
  constructor(private readonly repo: IMongoLogsRepository) {}

  async execute(req: SaveLogRequest): Promise<void> {
    if (!req?.log) return;
    await this.repo.insert(req.log);
  }
}
