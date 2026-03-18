import { LogFilterRequest } from "../../request";
import { LogEntry } from "../../model";
import { ILogResponse } from "../../response";

// Puerto base que deben implementar las fuentes de datos
export interface ILogDatasource {
  pruneOlderThan(arg0: number): unknown;
  // Persiste un evento de log
  save(log: LogEntry): Promise<void>;
  // Recupera eventos con filtros (opcional)
  find?(filter?: LogFilterRequest): Promise<ILogResponse[]>;
  // Fuerza escritura de buffers (si la impl. usa batch/cola)
  flush?(): Promise<void>;
  // Libera recursos (conexiones, handlers, etc.)
  dispose?(): Promise<void>;
  // Nombre lógico del datasource (útil para métricas/errores)
  readonly name?: string;
}
