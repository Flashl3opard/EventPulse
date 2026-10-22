import { loadConfig } from "@eventpulse/config";
import { getPrismaClient } from "@eventpulse/database";
import { createApp } from "./app.js";

const config = loadConfig();
const prisma = getPrismaClient();
const app = createApp(prisma);

app.listen(config.port, () => {
  console.log(`[api] listening on port ${config.port} (${config.nodeEnv})`);
});
