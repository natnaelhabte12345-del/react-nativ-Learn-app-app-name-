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

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function yesterdayISO(): string {
  return new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
}

type ProgressState = {
  completedLessonIds: string[];
  streak: number;
  dailyXp: number;
  lastActiveDate: string | null;

  completeLesson: (lessonId: string, xpReward?: number) => void;
  recordActivity: () => void;
  resetProgress: () => void;
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      completedLessonIds: [],
      streak: 0,
      dailyXp: 0,
      lastActiveDate: null,

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
