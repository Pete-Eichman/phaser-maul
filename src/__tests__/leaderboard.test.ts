// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeScore,
  loadLeaderboard,
  addLeaderboardEntry,
} from '@/utils/leaderboard';
import type { LeaderboardEntry } from '@/utils/leaderboard';

beforeEach(() => {
  localStorage.clear();
});

describe('computeScore', () => {
  it('normal difficulty full win produces expected value', () => {
    // kills×10 + waves×25 + lives×50 + 500, mult 1.0
    const expected = Math.round((50 * 10 + 10 * 25 + 15 * 50 + 500) * 1.0);
    expect(computeScore({
      killCount: 50, wavesCompleted: 10, livesRemaining: 15, won: true, difficulty: 'normal',
    })).toBe(expected);
  });

  it('easy difficulty applies 0.8 multiplier', () => {
    const raw = 50 * 10 + 10 * 25 + 15 * 50 + 500;
    expect(computeScore({
      killCount: 50, wavesCompleted: 10, livesRemaining: 15, won: true, difficulty: 'easy',
    })).toBe(Math.round(raw * 0.8));
  });

  it('hard difficulty applies 1.3 multiplier', () => {
    const raw = 50 * 10 + 10 * 25 + 15 * 50 + 500;
    expect(computeScore({
      killCount: 50, wavesCompleted: 10, livesRemaining: 15, won: true, difficulty: 'hard',
    })).toBe(Math.round(raw * 1.3));
  });

  it('loss omits win bonus — difference is exactly 500 × difficulty mult', () => {
    const base = { killCount: 30, wavesCompleted: 7, livesRemaining: 5, difficulty: 'normal' as const };
    const win  = computeScore({ ...base, won: true });
    const loss = computeScore({ ...base, won: false });
    expect(win - loss).toBe(500);
  });

  it('all-zero inputs with a loss returns 0', () => {
    expect(computeScore({
      killCount: 0, wavesCompleted: 0, livesRemaining: 0, won: false, difficulty: 'normal',
    })).toBe(0);
  });

  it('result is always an integer', () => {
    const score = computeScore({
      killCount: 7, wavesCompleted: 3, livesRemaining: 11, won: false, difficulty: 'hard',
    });
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe('addLeaderboardEntry', () => {
  const makeEntry = (score: number): LeaderboardEntry => ({
    score,
    difficulty: 'normal',
    mapId: 'classic',
    won: false,
    wavesCompleted: 5,
    killCount: 30,
    livesRemaining: 10,
    timestamp: Date.now(),
  });

  it('first entry is rank 1', () => {
    const { rank } = addLeaderboardEntry(makeEntry(1000));
    expect(rank).toBe(1);
  });

  it('higher score beats lower score into rank 1', () => {
    addLeaderboardEntry(makeEntry(500));
    const { rank } = addLeaderboardEntry(makeEntry(1000));
    expect(rank).toBe(1);
  });

  it('returns entries sorted descending by score', () => {
    addLeaderboardEntry(makeEntry(300));
    addLeaderboardEntry(makeEntry(800));
    const { entries } = addLeaderboardEntry(makeEntry(500));
    expect(entries[0].score).toBe(800);
    expect(entries[1].score).toBe(500);
    expect(entries[2].score).toBe(300);
  });

  it('trims to 10 entries maximum', () => {
    for (let i = 0; i < 10; i++) {
      addLeaderboardEntry(makeEntry((i + 1) * 100));
    }
    const { entries } = addLeaderboardEntry(makeEntry(1));
    expect(entries).toHaveLength(10);
  });

  it('entry below top-10 threshold returns rank 0', () => {
    for (let i = 1; i <= 10; i++) {
      addLeaderboardEntry(makeEntry(i * 1000));
    }
    const { rank } = addLeaderboardEntry(makeEntry(1));
    expect(rank).toBe(0);
  });

  it('persists entries across calls', () => {
    addLeaderboardEntry(makeEntry(999));
    const loaded = loadLeaderboard();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].score).toBe(999);
  });
});
