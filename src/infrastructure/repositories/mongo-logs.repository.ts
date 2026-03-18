import { LogEntry } from "../../domain/model";
import { LogFilterRequest } from "../../domain/request";
import { ILogResponse } from "../../domain/response";
import { IMongoLogsRepository, IMongoQueryClient } from "../../domain/ports";

/**
 * Implementación Mongo del repositorio de logs.
 *
 * - No depende del driver mongodb
 * - Usa IMongoQueryClient (puerto)
 * - Mantiene la misma semántica que PostgresLogsRepository
 */
export class MongoLogsRepository implements IMongoLogsRepository {
  constructor(
    private readonly client: IMongoQueryClient,
    private readonly dbName: string,
    private readonly collection: string
  ) {}

  // ---------------------------------------------------------------------------
  // HEALTHCHECK
  // ---------------------------------------------------------------------------

  async healthcheck(): Promise<void> {
    // Operación mínima y segura
    await this.client.find(this.dbName, this.collection, {}, { limit: 1 });
  }

  // ---------------------------------------------------------------------------
  // INSERT
  // ---------------------------------------------------------------------------

  async insert(log: LogEntry): Promise<void> {
    await this.client.insertOne(this.dbName, this.collection, {
      source: log.source ?? null,
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      meta: log.meta ?? null,
    });
  }

  // ---------------------------------------------------------------------------
  // FIND
  // ---------------------------------------------------------------------------

  async find(filter: LogFilterRequest): Promise<ILogResponse[]> {
    const f = filter ?? {};
    const query: Record<string, any> = {};

    if (f.levelMin != null) {
      query.level = { ...(query.level ?? {}), $gte: f.levelMin };
    }

    if (f.since != null) {
      query.timestamp = { ...(query.timestamp ?? {}), $gte: f.since };
    }

    if (f.until != null) {
      query.timestamp = { ...(query.timestamp ?? {}), $lte: f.until };
    }

    if (f.query && f.query.trim().length > 0) {
      query.message = { $regex: f.query.trim(), $options: "i" };
    }

    // Estrategia idéntica a Postgres:
    // 1) ordenar ASC
    // 2) paginar
    // 3) invertir en memoria (DESC final)
    const options: {
      sort?: Record<string, 1 | -1>;
      limit?: number;
      skip?: number;
    } = {
      sort: { timestamp: 1 },
    };

    const hasLimit = typeof f.limit === "number";
    const hasOffsetPage =
      typeof f.offset === "number" && Number.isFinite(f.offset) && f.offset > 0;

    if (hasLimit) {
      options.limit = f.limit;

      if (hasOffsetPage) {
        options.skip = f.offset! * f.limit!;
      }
    } else if (hasOffsetPage) {
      options.skip = f.offset;
    }

    const res = await this.client.find<ILogResponse>(
      this.dbName,
      this.collection,
      query,
      options
    );

    const docs = res.documents ?? [];
    return docs.slice().reverse();
  }

  // ---------------------------------------------------------------------------
  // PRUNE
  // ---------------------------------------------------------------------------

  async pruneOlderThan(days: number): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const res = await this.client.deleteMany(this.dbName, this.collection, {
      timestamp: { $lt: cutoff },
    });

    return res.deletedCount ?? 0;
  }
}
