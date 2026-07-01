import { config } from "dotenv";
import { connectMongo, disconnectMongo } from "./lib/mongo.js";
import { createApp } from "./express-app.js";

config();
config({ path: ".env.local", override: true });

const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 5000);

async function main() {
  await connectMongo();
  const app = createApp();

  app.listen(port, () => {
    console.log(`Backend API running at http://localhost:${port}`);
  });
}

main().catch(async (err) => {
  console.error("[server] Failed to start:", err);
  await disconnectMongo();
  process.exit(1);
});
