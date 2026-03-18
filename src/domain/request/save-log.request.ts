import { LogEntry } from "../model";

/**
 * Request model del caso de uso SaveLog.
 */
export interface SaveLogRequest {
  log: LogEntry;
}
