import { LogLevel } from "../value-objects";

export interface ILogResponse {
  // Origen del log (nombre de la aplicación o servicio)
  source: string;
  // nivel de severidad (ver LogLevel)
  level: LogLevel;
  // mensaje final (ya normalizado y con PII redactado)
  message: string | Record<string, unknown>;
  // metadatos opcionales adjuntos al evento
  meta?: unknown;
  // epoch millis
  timestamp: number;
}
