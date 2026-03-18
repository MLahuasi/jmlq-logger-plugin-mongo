// tests/helpers/memory-mongo.ts
import { MongoMemoryServer } from "mongodb-memory-server-core";

let mongo: MongoMemoryServer | null = null;

export async function getMemoryMongoUri(dbName = "test-logs"): Promise<string> {
  if (!mongo) {
    mongo = await MongoMemoryServer.create({
      instance: { dbName },
    });
  }

  return mongo!.getUri();
}

export async function stopMemoryMongo(): Promise<void> {
  if (!mongo) return;

  await mongo.stop();
  mongo = null;
}
