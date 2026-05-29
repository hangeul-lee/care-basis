import { createStore } from "./store/index.js";

if (process.env.DB_MODE !== "mysql") {
  process.env.DB_MODE = "mysql";
}

await createStore();
console.log("MySQL schema is ready.");
