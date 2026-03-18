import type { IMongoQueryClient } from "../../domain/ports";
import type { ExtraIndexConfig } from "../../infrastructure/types";
import { bootstrapMongoCollectionAndIndexes } from "../../infrastructure/services";

export class EnsureSchemaUseCase {
  constructor(
    private readonly client: IMongoQueryClient,
    private readonly dbName: string,
    private readonly collectionName: string,
    private readonly createIfMissing: boolean,
    private readonly ensureIndexes: boolean,
    private readonly retentionDays: number | null,
    private readonly extraIndexes: ExtraIndexConfig[]
  ) {}

  async execute(): Promise<void> {
    await bootstrapMongoCollectionAndIndexes({
      client: this.client,
      dbName: this.dbName,
      collectionName: this.collectionName,
      createIfMissing: this.createIfMissing,
      ensureIndexes: this.ensureIndexes,
      retentionDays: this.retentionDays,
      extraIndexes: this.extraIndexes,
    });
  }
}
