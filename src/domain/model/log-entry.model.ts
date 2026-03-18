import { LogLevel } from "../value-objects";

export interface LogEntry {
  source: string; // origen del log (nombre de la aplicación o servicio)
  // nivel de severidad (ver LogLevel)
  level: LogLevel;
  // mensaje final (ya normalizado y con PII redactado)
  message: string | Record<string, unknown>;
  // metadatos opcionales adjuntos al evento
  meta?: unknown;
  // epoch millis
  timestamp: number;
}
