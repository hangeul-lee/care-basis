import { resolve } from "node:path";
import { FileStore } from "./fileStore.js";
import { MySqlStore } from "./mysqlStore.js";

export async function createStore() {
  if (process.env.DB_MODE === "mysql") {
    const store = new MySqlStore({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "care_basis",
      ssl: process.env.DB_SSL === "true",
      sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
      sslCa: process.env.DB_SSL_CA || "",
      sslCaBase64: process.env.DB_SSL_CA_B64 || "",
      autoMigrate: process.env.DB_AUTO_MIGRATE !== "false"
    });
    await store.init();
    return store;
  }

  const store = new FileStore(resolve(process.cwd(), "data", "app-data.json"));
  await store.init();
  return store;
}
