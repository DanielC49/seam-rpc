import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";
// Seeds dev/demo mock data by running database/mockdata.sql against DATABASE_URL.
// Wired as the Prisma seed command (prisma.config.ts) so it runs automatically on
// `prisma migrate dev` / `prisma migrate reset`, and explicitly in the Docker
// migrate step. It is NOT run by `prisma migrate deploy`, so it never seeds prod.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set — cannot seed. Set it in .env (see docs/database.md).",
  );
}
const sqlFile = "./database/mockdata.sql";
const sql = readFileSync(sqlFile, "utf8");
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query(sql);
  console.log(`✔ Seed applied from ${sqlFile}`);
} finally {
  await client.end();
}