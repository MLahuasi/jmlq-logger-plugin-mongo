import { MongoClient, Db } from "mongodb";

export async function connectMongo(uri: string): Promise<MongoClient> {
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

export async function dropDb(
  client: MongoClient,
  dbName: string
): Promise<void> {
  const db = client.db(dbName);
  await db.dropDatabase();
}

export async function getDb(client: MongoClient, dbName: string): Promise<Db> {
  return client.db(dbName);
}
