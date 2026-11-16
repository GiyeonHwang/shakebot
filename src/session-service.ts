import { randomUUID } from "node:crypto";
import { splitTeams } from "./teams.ts";
import type { TeamSize } from "./teams.ts";

export const maxParticipants = 25;
export const maxNameLength = 40;

type Participant = {
  id: string;
  name: string;
  source: "manual" | "voice";
};

export type Session = {
  id: string;
  guildId: string;
  ownerId: string;
  size: TeamSize;
  participants: Map<string, Participant>;
  teams?: [Participant[], Participant[]];
  lastActiveAt: number;
};

export class SessionError extends Error {}

function cleanName(value: string): string {
  const name = value.trim();
  if (!name || name.length > maxNameLength || /[\r\n]/u.test(name)) {
    throw new SessionError(`이름은 한 줄에 1~${maxNameLength}자로 입력해 주세요.`);
  }
  return name;
}

export class SessionService {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly ttlMs: number, private readonly now = Date.now) {}

  create(guildId: string, ownerId: string, size: TeamSize): Session {
    const session: Session = {
      id: randomUUID(),
      guildId,
      ownerId,
      size,
      participants: new Map(),
      lastActiveAt: this.now(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  requireOwner(id: string, guildId: string | null, ownerId: string): Session {
    const session = this.sessions.get(id);
    if (!session || this.isExpired(session)) {
      this.sessions.delete(id);
      throw new SessionError("세션이 만료되었습니다. /팀배분으로 새 세션을 만들어 주세요.");
    }
    if (session.guildId !== guildId || session.ownerId !== ownerId) {
      throw new SessionError("이 세션은 개최자만 조작할 수 있습니다.");
    }
    return session;
  }

  touch(session: Session): void {
    session.lastActiveAt = this.now();
  }

  addManual(session: Session, names: string[]): number {
    return this.add(session, names.map(name => ({
      id: randomUUID(),
      name: cleanName(name),
      source: "manual",
    })));
  }

  addVoice(session: Session, members: { id: string; name: string }[]): number {
    return this.add(session, members
      .filter(member => !session.participants.has(member.id))
      .map(member => ({
        id: member.id,
        name: cleanName(member.name),
        source: "voice",
      })));
  }

  setSize(session: Session, size: TeamSize): void {
    if (session.size === size) return;
    session.size = size;
    session.teams = undefined;
  }

  remove(session: Session, id: string): void {
    this.requireParticipant(session, id);
    session.participants.delete(id);
    session.teams = undefined;
  }

  rename(session: Session, id: string, name: string): void {
    this.requireParticipant(session, id).name = cleanName(name);
  }

  requireParticipant(session: Session, id: string): Participant {
    const participant = session.participants.get(id);
    if (!participant) throw new SessionError("참가자가 이미 삭제되었습니다.");
    return participant;
  }

  shuffle(session: Session): void {
    const required = session.size * 2;
    if (session.participants.size !== required) {
      throw new SessionError(`팀을 배분하려면 참가자가 정확히 ${required}명이어야 합니다.`);
    }
    session.teams = splitTeams([...session.participants.values()], session.size);
  }

  purgeExpired(): void {
    for (const [id, session] of this.sessions) {
      if (this.isExpired(session)) this.sessions.delete(id);
    }
  }

  private isExpired(session: Session): boolean {
    return this.now() - session.lastActiveAt >= this.ttlMs;
  }

  private add(session: Session, participants: Participant[]): number {
    if (session.participants.size + participants.length > maxParticipants) {
      throw new SessionError(`참가자는 최대 ${maxParticipants}명까지 추가할 수 있습니다.`);
    }
    for (const participant of participants) session.participants.set(participant.id, participant);
    if (participants.length > 0) session.teams = undefined;
    return participants.length;
  }
}
