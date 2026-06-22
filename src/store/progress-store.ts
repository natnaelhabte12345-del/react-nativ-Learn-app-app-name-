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

type ProgressState = {
  completedLessonIds: string[];
  completeLesson: (lessonId: string) => void;
  resetProgress: () => void;
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      completedLessonIds: [],
      completeLesson: (lessonId) =>
        set((state) => ({
          completedLessonIds: state.completedLessonIds.includes(lessonId)
            ? state.completedLessonIds
            : [...state.completedLessonIds, lessonId],
        })),
      resetProgress: () => set({ completedLessonIds: [] }),
    }),
    {
      name: "fluentflow-progress-state",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? serverStorage : AsyncStorage,
      ),
    },
  ),
);
