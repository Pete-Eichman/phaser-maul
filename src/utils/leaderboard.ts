import { DifficultyKey, SCORE_WEIGHTS } from '@/config/gameConfig';

export interface LeaderboardEntry {
  score: number;
  difficulty: DifficultyKey;
  mapId: string;
  won: boolean;
  wavesCompleted: number;
  killCount: number;
  livesRemaining: number;
  timestamp: number;
}

const STORAGE_KEY = 'phaserMaul_leaderboard';
const MAX_ENTRIES = 10;

export function computeScore(params: {
  killCount: number;
  wavesCompleted: number;
  livesRemaining: number;
  won: boolean;
  difficulty: DifficultyKey;
}): number {
  const { killCount, wavesCompleted, livesRemaining, won, difficulty } = params;
  const w = SCORE_WEIGHTS;
  const raw =
    killCount      * w.killMultiplier  +
    wavesCompleted * w.waveMultiplier  +
    livesRemaining * w.livesMultiplier +
    (won ? w.winBonus : 0);
  return Math.round(raw * w.difficultyMult[difficulty]);
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addLeaderboardEntry(
  newEntry: LeaderboardEntry,
): { entries: LeaderboardEntry[]; rank: number } {
  const combined = [...loadLeaderboard(), newEntry];
  combined.sort((a, b) => b.score - a.score);
  const trimmed = combined.slice(0, MAX_ENTRIES);
  saveLeaderboard(trimmed);
  const rank = trimmed.findIndex(e => e === newEntry) + 1;
  return { entries: trimmed, rank: rank > 0 ? rank : 0 };
}
