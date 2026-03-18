// src/domain/ports/mongo-logs.repository.ts

import { LogEntry } from "../model";
import { LogFilterRequest } from "../request";
import { ILogResponse } from "../response";

/**
 * Puerto de repositorio para persistencia de logs en MongoDB.
 *
 * ⚠️ No depende de mongodb ni de ningún driver concreto.
 * El host (Express / Next / Nest) provee la implementación real.
 */
export interface IMongoLogsRepository {
  /**
   * Inserta un log en el repositorio.
   */
  insert(log: LogEntry): Promise<void>;

  /**
   * Recupera logs según filtros de dominio.
   */
  find(filter: LogFilterRequest): Promise<ILogResponse[]>;

  /**
   * Elimina logs más antiguos que N días.
   *
   * Retorna la cantidad de documentos eliminados.
   * Puede implementarse como:
   *  - deleteMany (manual)
   *  - no-op si se usa TTL real
   */
  pruneOlderThan(days: number): Promise<number>;

  /**
   * Verifica conectividad / disponibilidad del repositorio.
   *
   * Debe lanzar error si el repositorio no está operativo.
   */
  healthcheck(): Promise<void>;
}
