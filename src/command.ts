import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { teamSizes } from "./teams.ts";

export const command = new SlashCommandBuilder()
  .setName("팀배분")
  .setDescription("팀 배분 세션을 만듭니다.")
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption(option => option
    .setName("팀크기")
    .setDescription("팀당 인원수")
    .setRequired(true)
    .addChoices(...teamSizes.map(size => ({ name: `${size}:${size}`, value: size }))));
