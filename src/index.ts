import { Client, Events, GatewayIntentBits } from "discord.js";
import { requiredEnv, sessionTtlMs } from "./config.ts";
import { createInteractionHandler } from "./interactions.ts";
import { SessionService } from "./session-service.ts";

const token = requiredEnv("DISCORD_TOKEN");
const ttl = sessionTtlMs();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const sessions = new SessionService(ttl);
const cleanup = setInterval(() => sessions.purgeExpired(), Math.min(ttl, 60_000));
cleanup.unref();

const handleInteraction = createInteractionHandler(sessions);
client.on(Events.InteractionCreate, interaction => {
  void handleInteraction(interaction).catch(logError);
});
client.on(Events.Error, logError);
client.once(Events.ClientReady, ready => console.log(`${ready.user.tag} 봇이 연결되었습니다.`));

function logError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
}

async function shutdown(): Promise<void> {
  clearInterval(cleanup);
  await client.destroy();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown().catch(error => {
    logError(error);
    process.exitCode = 1;
  }));
}

try {
  await client.login(token);
} catch (error) {
  logError(error);
  await shutdown();
  process.exitCode = 1;
}
