import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

const serverStorage: StateStorage = {
  getItem: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};

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

type ProgressState = {
  hasHydrated: boolean;
  completedLessonIds: string[];
  streak: number;
  dailyXp: number;
  lastActiveDate: string | null;

  completeLesson: (lessonId: string, xpReward?: number) => void;
  recordActivity: () => void;
  resetProgress: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      completedLessonIds: [],
      streak: 0,
      dailyXp: 0,
      lastActiveDate: null,
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

      resetProgress: () =>
        set({ completedLessonIds: [], streak: 0, dailyXp: 0, lastActiveDate: null }),
    }),
    {
      name: "fluentflow-progress-state",
      version: 2,
      onRehydrateStorage: (state) => (_rehydratedState, error) => {
        if (error) {
          console.warn("Failed to hydrate progress state", error);
        }

        // Mark hydrated once rehydration completes so consumers don't read or
        // write streak/XP against stale defaults.
        state.setHasHydrated(true);
      },
      migrate: (persistedState) => {
        const state = persistedState as Partial<ProgressState>;

        // Version 1 marked a lesson complete whenever a call was ended, even if
        // the learner had not finished it. Clear those invalid completion flags.
        return {
          ...state,
          completedLessonIds: [],
          dailyXp: 0,
        } as ProgressState;
      },
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? serverStorage : AsyncStorage,
      ),
    },
  ),
);
