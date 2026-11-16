import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";
import type {
  ButtonInteraction, ChatInputCommandInteraction, Guild, Interaction,
  ModalSubmitInteraction, StringSelectMenuInteraction,
} from "discord.js";
import { command } from "./command.ts";
import { addModal, panel, renameModal } from "./panel.ts";
import { maxNameLength, SessionError } from "./session-service.ts";
import type { SessionService } from "./session-service.ts";
import { isTeamSize } from "./teams.ts";

type PanelInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

async function voiceMembers(guild: Guild | null, ownerId: string) {
  if (!guild?.available) throw new SessionError("서버의 음성 채널 정보를 불러올 수 없습니다.");
  const channel = guild.voiceStates.cache.get(ownerId)?.channel;
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new SessionError("먼저 서버의 음성 채널에 참가해 주세요.");
  }
  if (!guild.members.me || !channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ViewChannel)) {
    throw new SessionError("봇에 이 음성 채널의 채널 보기 권한이 필요합니다.");
  }

  const states = guild.voiceStates.cache.filter(state => state.channelId === channel.id);
  const members = await Promise.all(states.map(state => state.member ?? guild.members.fetch(state.id)));
  return members
    .filter(member => !member.user.bot && member.voice.channelId === channel.id)
    .map(member => ({
      id: member.id,
      name: member.displayName.replace(/[\r\n]+/gu, " ").trim()
        .slice(0, maxNameLength).replace(/[\uD800-\uDBFF]$/u, "") || member.user.username,
    }));
}

export function createInteractionHandler(sessions: SessionService) {
  const pendingEdits = new Map<string, Promise<void>>();

  async function edit(interaction: PanelInteraction, id: string, action: string, participantId?: string) {
    if (interaction.isModalSubmit() && !interaction.isFromMessage()) return;

    // Queue changes and message edits together so a slow edit cannot restore an older panel.
    const acknowledged = interaction.deferUpdate();
    const previous = pendingEdits.get(id) ?? Promise.resolve();
    const current = Promise.all([previous, acknowledged]).then(async () => {
      const session = sessions.requireOwner(id, interaction.guildId, interaction.user.id);
      let notice: string | undefined;

      if (interaction.isButton() && action === "voice") {
        const members = await voiceMembers(interaction.guild, session.ownerId);
        sessions.requireOwner(id, interaction.guildId, interaction.user.id);
        const added = sessions.addVoice(session, members);
        notice = added ? `음성 채널 참가자 ${added}명을 추가했습니다.` : "추가할 새 음성 채널 참가자가 없습니다.";
      } else if (interaction.isButton() && action === "shuffle") {
        sessions.shuffle(session);
      } else if (interaction.isStringSelectMenu() && action === "size") {
        const size = Number(interaction.values[0]);
        if (!isTeamSize(size)) throw new SessionError("팀 크기가 올바르지 않습니다.");
        sessions.setSize(session, size);
      } else if (interaction.isStringSelectMenu() && action === "remove") {
        sessions.remove(session, interaction.values[0]);
      } else if (interaction.isModalSubmit() && action === "add-submit") {
        const names = interaction.fields.getTextInputValue("names").split(/\r?\n/u).map(name => name.trim()).filter(Boolean);
        if (!names.length) throw new SessionError("참가자 이름을 한 명 이상 입력해 주세요.");
        sessions.addManual(session, names);
      } else if (interaction.isModalSubmit() && action === "rename-submit" && participantId) {
        sessions.rename(session, participantId, interaction.fields.getTextInputValue("name"));
      } else {
        throw new SessionError("이 조작을 처리할 수 없습니다.");
      }

      sessions.touch(session);
      await interaction.editReply(panel(session, notice));
    });

    const settled = current.catch(() => {});
    pendingEdits.set(id, settled);
    try {
      await current;
    } finally {
      if (pendingEdits.get(id) === settled) pendingEdits.delete(id);
    }
  }

  return async (interaction: Interaction): Promise<void> => {
    if (interaction.isChatInputCommand() && interaction.commandName === command.name) {
      try {
        const size = interaction.options.getInteger("팀크기", true);
        if (!interaction.guildId || !isTeamSize(size)) {
          throw new SessionError("서버에서 3:3, 4:4, 5:5 중 하나를 선택해 주세요.");
        }
        const session = sessions.create(interaction.guildId, interaction.user.id, size);
        await interaction.reply(panel(session));
      } catch (error) {
        await replyError(interaction, error);
      }
      return;
    }

    if (!(interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit())) return;
    const [namespace, id, action, participantId] = interaction.customId.split(":");
    if (namespace !== "teams") return;

    try {
      const session = sessions.requireOwner(id, interaction.guildId, interaction.user.id);
      if (interaction.isButton() && action === "add") {
        await interaction.showModal(addModal(session));
        sessions.touch(session);
      } else if (interaction.isStringSelectMenu() && action === "rename") {
        const participant = sessions.requireParticipant(session, interaction.values[0]);
        await interaction.showModal(renameModal(session, participant.id, participant.name));
        sessions.touch(session);
      } else {
        await edit(interaction, id, action, participantId);
      }
    } catch (error) {
      await replyError(interaction, error);
    }
  };
}

async function replyError(interaction: PanelInteraction | ChatInputCommandInteraction, error: unknown) {
  if (!(error instanceof SessionError)) console.error(error instanceof Error ? error.message : String(error));
  const message = {
    content: error instanceof SessionError ? error.message : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    flags: MessageFlags.Ephemeral as const,
  };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(message);
  } else {
    await interaction.reply(message);
  }
}
