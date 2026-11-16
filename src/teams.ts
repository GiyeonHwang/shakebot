import { randomInt } from "node:crypto";

export const teamSizes = [3, 4, 5] as const;
export type TeamSize = (typeof teamSizes)[number];

export function isTeamSize(value: number): value is TeamSize {
  return value === 3 || value === 4 || value === 5;
}

export function splitTeams<T>(participants: readonly T[], size: TeamSize): [T[], T[]] {
  const shuffled = [...participants];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return [shuffled.slice(0, size), shuffled.slice(size)];
}
