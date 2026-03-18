import type { IMongoLogsRepository } from "../../domain/ports";

export interface PruneLogsRequest {
  days: number;
}

export interface IPruneLogsUseCase {
  execute(req: PruneLogsRequest): Promise<number>;
}

/**
 * PruneLogsUseCase
 * -----------------------------------------------------------------------------
 * Caso de uso para limpieza por retención en Mongo.
 *
 * SRP:
 * - Validar / normalizar el input (days)
 * - Delegar la operación al repositorio
 *
 * Nota:
 * - Si el repositorio usa TTL real, puede implementar pruneOlderThan()
 *   como no-op y retornar 0.
 */
export class PruneLogsUseCase implements IPruneLogsUseCase {
  constructor(
    private readonly repo: IMongoLogsRepository
  ) {}

  async execute(req: PruneLogsRequest): Promise<number> {
    const days = Number(req?.days);

    // validación mínima defensiva
    if (!Number.isFinite(days) || days <= 0) return 0;

    return this.repo.pruneOlderThan(days);
  }
}
