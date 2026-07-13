import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createAppPersistStorage } from "@/lib/storage";

// Build a YYYY-MM-DD key from local date parts so day boundaries follow the
// learner's local midnight (not UTC) and stay correct across DST transitions.
function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayISO(): string {
  return toLocalDateKey(new Date());
}

function yesterdayISO(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toLocalDateKey(date);
}

// XP the learner must earn in a day to complete the daily goal, and the bonus
// they receive when they claim the daily-goal reward chest.
export const DAILY_GOAL_XP = 20;
export const DAILY_REWARD_BONUS_XP = 5;

// ─── Spaced repetition (Leitner boxes) ──────────────────────────────────────
// Each reviewable chunk moves up a "box" when the learner recalls it correctly
// and drops back to box 0 when they miss it. The box index chooses how long we
// wait before showing it again — the core of evidence-based review: items you
// know are spaced further out, items you struggle with come back soon.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const REVIEW_INTERVALS_MS = [
  0, // box 0 — due immediately (just missed, or brand new)
  4 * HOUR_MS, // box 1
  DAY_MS, // box 2
  3 * DAY_MS, // box 3
  7 * DAY_MS, // box 4
  21 * DAY_MS, // box 5 — considered "learned"
];
export const MAX_REVIEW_STRENGTH = REVIEW_INTERVALS_MS.length - 1;

// Per-chunk memory of how well the learner knows it. `strength` is the Leitner
// box (0..MAX). `lapses` counts misses — the signal we use to surface weak
// items to the tutor and prioritize them in practice.
export type ReviewProgress = {
  strength: number;
  lapses: number;
  seen: number;
  dueAt: number;
  lastReviewedAt: number;
};

type ProgressState = {
  hasHydrated: boolean;
  completedLessonIds: string[];
  streak: number;
  dailyXp: number;
  lastActiveDate: string | null;
  // The local date (YYYY-MM-DD) on which the daily-goal reward was last claimed.
  // Used to ensure the reward chest can only be claimed once per day.
  lastRewardDate: string | null;
  // Spaced-repetition memory keyed by review-target id (see lib/learning-review).
  reviewProgress: Record<string, ReviewProgress>;

  completeLesson: (lessonId: string, xpReward?: number) => void;
  recordActivity: () => void;
  recordReviewResult: (reviewId: string, correct: boolean) => void;
  claimDailyReward: () => void;
  resetProgress: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

// True when the learner has hit today's goal but hasn't claimed the reward yet.
export function selectDailyRewardAvailable(state: ProgressState): boolean {
  return state.dailyXp >= DAILY_GOAL_XP && state.lastRewardDate !== todayISO();
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      completedLessonIds: [],
      streak: 0,
      dailyXp: 0,
      lastActiveDate: null,
      lastRewardDate: null,
      reviewProgress: {},
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      completeLesson: (lessonId, xpReward = 10) =>
        set((state) => {
          const alreadyDone = state.completedLessonIds.includes(lessonId);
          return {
            completedLessonIds: alreadyDone
              ? state.completedLessonIds
              : [...state.completedLessonIds, lessonId],
            dailyXp: alreadyDone ? state.dailyXp : state.dailyXp + xpReward,
          };
        }),

      recordActivity: () =>
        set((state) => {
          const today = todayISO();
          // Already recorded today — no change needed
          if (state.lastActiveDate === today) return {};
          const isConsecutive = state.lastActiveDate === yesterdayISO();
          return {
            streak: isConsecutive ? state.streak + 1 : 1,
            dailyXp: 0, // Reset daily XP at the start of each new day
            lastActiveDate: today,
          };
        }),

      // Record one practice answer for a review target. Correct answers move the
      // chunk up a Leitner box (longer wait); misses drop it to box 0 and bump
      // the lapse counter so it resurfaces soon and is flagged as a weak spot.
      recordReviewResult: (reviewId, correct) =>
        set((state) => {
          const now = Date.now();
          const prev = state.reviewProgress[reviewId] ?? {
            strength: 0,
            lapses: 0,
            seen: 0,
            dueAt: 0,
            lastReviewedAt: 0,
          };
          const strength = correct
            ? Math.min(prev.strength + 1, MAX_REVIEW_STRENGTH)
            : 0;
          return {
            reviewProgress: {
              ...state.reviewProgress,
              [reviewId]: {
                strength,
                lapses: correct ? prev.lapses : prev.lapses + 1,
                seen: prev.seen + 1,
                dueAt: now + REVIEW_INTERVALS_MS[strength],
                lastReviewedAt: now,
              },
            },
          };
        }),

      // Claim the once-per-day daily-goal reward. Guarded so it only pays out
      // when the goal is actually met and hasn't already been claimed today.
      claimDailyReward: () =>
        set((state) => {
          const today = todayISO();
          if (state.lastRewardDate === today) return {};
          if (state.dailyXp < DAILY_GOAL_XP) return {};
          return {
            dailyXp: state.dailyXp + DAILY_REWARD_BONUS_XP,
            lastRewardDate: today,
          };
        }),

      resetProgress: () =>
        set({
          completedLessonIds: [],
          streak: 0,
          dailyXp: 0,
          lastActiveDate: null,
          lastRewardDate: null,
          reviewProgress: {},
        }),
    }),
    {
      name: "fluentflow-progress-state",
      version: 3,
      onRehydrateStorage: (state) => (_rehydratedState, error) => {
        if (error) {
          console.warn("Failed to hydrate progress state", error);
        }

        // Mark hydrated once rehydration completes so consumers don't read or
        // write streak/XP against stale defaults.
        state.setHasHydrated(true);
      },
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<ProgressState>;

        // Version 1 marked a lesson complete whenever a call was ended, even if
        // the learner had not finished it. Clear those invalid completion flags.
        if (version < 2) {
          return {
            ...state,
            completedLessonIds: [],
            dailyXp: 0,
            reviewProgress: {},
          } as ProgressState;
        }

        // v2 -> v3 added spaced-repetition review memory. Keep existing progress
        // intact and just backfill the new field.
        return {
          ...state,
          reviewProgress: state.reviewProgress ?? {},
        } as ProgressState;
      },
      storage: createAppPersistStorage(),
    },
  ),
);
