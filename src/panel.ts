import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, LabelBuilder, ModalBuilder,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, escapeMarkdown,
} from "discord.js";
import { maxNameLength, maxParticipants } from "./session-service.ts";
import type { Session } from "./session-service.ts";
import { teamSizes } from "./teams.ts";

export function controlId(session: Session, action: string, participantId?: string): string {
  return ["teams", session.id, action, participantId].filter(Boolean).join(":");
}

export function panel(session: Session, notice?: string) {
  const participants = [...session.participants.values()];
  const required = session.size * 2;
  const roster = participants.map(({ name, source }, index) =>
    `${index + 1}. ${escapeMarkdown(name)} · ${source === "voice" ? "음성" : "직접 입력"}`);
  const embed = new EmbedBuilder()
    .setTitle(`팀 배분 · ${session.size}:${session.size}`)
    .setColor(0x5865f2)
    .setDescription([
      `개최자 <@${session.ownerId}> · 참가자 **${participants.length}/${required}명**`,
      notice,
      "",
      roster.join("\n") || "참가자를 추가해 주세요.",
    ].filter(line => line !== undefined).join("\n"))
    .setFooter({ text: `세션 ID ${session.id}` });

  if (session.teams) {
    embed.addFields(session.teams.map((team, index) => ({
      name: `${index + 1}팀`,
      value: team.map(({ name }) => escapeMarkdown(name)).join("\n"),
      inline: true,
    })));
  }

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(controlId(session, "add"))
      .setLabel("직접 추가").setStyle(ButtonStyle.Secondary)
      .setDisabled(participants.length >= maxParticipants),
    new ButtonBuilder().setCustomId(controlId(session, "voice"))
      .setLabel("내 음성 채널에서 추가").setStyle(ButtonStyle.Secondary)
      .setDisabled(participants.length >= maxParticipants),
    new ButtonBuilder().setCustomId(controlId(session, "shuffle"))
      .setLabel(session.teams ? "다시 섞기" : "팀 배분").setStyle(ButtonStyle.Primary)
      .setDisabled(participants.length !== required),
  );
  const size = new StringSelectMenuBuilder()
    .setCustomId(controlId(session, "size"))
    .setPlaceholder("팀 크기 변경")
    .addOptions(teamSizes.map(value => ({ label: `${value}:${value}`, value: String(value) })));
  const components: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] = [
    buttons,
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(size),
  ];

  if (participants.length) {
    const options = participants.map(({ id, name, source }, index) => ({
      label: `${index + 1}. ${name}`,
      description: source === "voice" ? "음성 채널" : "직접 입력",
      value: id,
    }));
    for (const [action, placeholder] of [["remove", "삭제할 참가자 선택"], ["rename", "이름을 바꿀 참가자 선택"]]) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(controlId(session, action))
        .setPlaceholder(placeholder)
        .addOptions(options);
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
    }
  }

  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

export function addModal(session: Session): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("names")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(maxParticipants * (maxNameLength + 2))
    .setRequired(true);
  return new ModalBuilder()
    .setCustomId(controlId(session, "add-submit"))
    .setTitle("참가자 직접 추가")
    .addLabelComponents(new LabelBuilder().setLabel("참가자 이름 (한 줄에 한 명)").setTextInputComponent(input));
}

export function renameModal(session: Session, id: string, name: string): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("name")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(maxNameLength)
    .setValue(name)
    .setRequired(true);
  return new ModalBuilder()
    .setCustomId(controlId(session, "rename-submit", id))
    .setTitle("참가자 이름 변경")
    .addLabelComponents(new LabelBuilder().setLabel("새 표시 이름").setTextInputComponent(input));
}
