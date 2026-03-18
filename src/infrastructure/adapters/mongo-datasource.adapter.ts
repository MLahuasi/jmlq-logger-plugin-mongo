import type {
  ILogDatasource,
  LogEntry as CoreLogEntry,
  LogSearchRequest,
  LogRecord,
} from "@jmlq/logger";

import type {
  SaveLogUseCase,
  FindLogsUseCase,
  PruneLogsUseCase,
  EnsureSchemaUseCase,
} from "../../application/use-cases";

import type { SaveLogRequest } from "../../domain/request";

/**
 * Adapter que expone el contrato del core (@jmlq/logger) y, opcionalmente,
 * permite inicializar el schema/índices de Mongo.
 *
 * - Thin adapter: delega a use-cases.
 * - NO conoce mongodb (driver).
 * - NO gestiona el lifecycle de conexiones (eso lo maneja el factory/host).
 */
export class MongoDatasourceAdapter implements ILogDatasource {
  readonly name = "mongo";

  constructor(
    private readonly saveLogUseCase: SaveLogUseCase,
    private readonly findLogsUseCase: FindLogsUseCase,
    private readonly ensureSchemaUseCase?: EnsureSchemaUseCase,
    private readonly pruneLogsUseCase?: PruneLogsUseCase
  ) {}

  // ---------------------------------------------------------------------------
  // Core contract
  // ---------------------------------------------------------------------------

  async save(log: CoreLogEntry): Promise<void> {
    const dto: SaveLogRequest = { log };
    await this.saveLogUseCase.execute(dto);
  }

  async find(filter?: LogSearchRequest): Promise<LogRecord[]> {
    // Si tu dominio usa el mismo shape que el core:
    const domainFilter = (filter ?? {}) as any;

    const result = await this.findLogsUseCase.execute(domainFilter);

    // Si el use-case retorna ILogResponse dominio, mapearías aquí.
    // Si ya retorna LogRecord del core, devuelves directo.
    return result as any;
  }

  /**
   * Mongo en este plugin no tiene buffer interno.
   * Se implementa por estandarización del contrato.
   */
  async flush(): Promise<void> {
    // noop
  }

  /**
   * Este adapter NO es dueño del client/conexión.
   * El ciclo de vida lo gestiona el factory/host.
   */
  async dispose(): Promise<void> {
    // noop
  }

  // ---------------------------------------------------------------------------
  // Plugin features (opcionales)
  // ---------------------------------------------------------------------------

  /**
   * Inicializa colección/índices/TTL (si el factory inyectó EnsureSchemaUseCase).
   * NO forma parte del contrato core, pero unifica el rol de MongoSchemaInitializer.
   */
  async ensureSchema(): Promise<void> {
    if (!this.ensureSchemaUseCase) return;
    await this.ensureSchemaUseCase.execute();
  }

  /**
   * Retención manual (si el factory inyectó PruneLogsUseCase).
   */
  async pruneOlderThan(days: number): Promise<number> {
    if (!this.pruneLogsUseCase) return 0;
    return this.pruneLogsUseCase.execute({ days });
  }
}
