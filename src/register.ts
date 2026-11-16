import { REST, Routes } from "discord.js";
import { command } from "./command.ts";
import { requiredEnv } from "./config.ts";

const clientId = requiredEnv("DISCORD_CLIENT_ID");
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const rest = new REST({ version: "10" }).setToken(requiredEnv("DISCORD_TOKEN"));
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);
const body = command.toJSON();
if (guildId) delete body.contexts;

try {
  await rest.post(route, { body });
  console.log(guildId ? "테스트 서버에 명령을 등록했습니다." : "전역 명령을 등록했습니다.");
} catch (error) {
  console.error("명령 등록 실패", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
