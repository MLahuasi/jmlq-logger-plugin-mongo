import { LogLevel } from "../value-objects";

// Filtro opcional para recuperar logs desde un datasource
export interface LogFilterRequest {
  levelMin?: LogLevel; // recuperar desde un nivel mínimo
  since?: number; // epoch millis desde
  until?: number; // epoch millis hasta
  limit?: number; // máximo de elementos
  offset?: number; // desplazamiento para paginación
  query?: string; // término de búsqueda simple
}
