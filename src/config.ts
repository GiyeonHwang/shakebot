export function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} 환경 변수를 설정해 주세요.`);
  return value;
}

export function sessionTtlMs(): number {
  const minutes = Number(process.env.SESSION_TTL_MINUTES ?? 60);
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error("SESSION_TTL_MINUTES는 1~1440 사이의 정수여야 합니다.");
  }
  return minutes * 60_000;
}
