export enum LogLevel {
  // Orden creciente permite comparar por severidad (trace < debug < ...)
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60,
}
