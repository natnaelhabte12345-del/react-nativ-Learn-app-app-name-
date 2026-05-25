import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

import type { LanguageId } from "@/types/learning";

const serverStorage: StateStorage = {
  getItem: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};

type LanguageState = {
  hasHydrated: boolean;
  selectedLanguageId: LanguageId | null;
  clearSelectedLanguage: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setSelectedLanguage: (languageId: LanguageId) => void;
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      selectedLanguageId: null,
      clearSelectedLanguage: () => set({ selectedLanguageId: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setSelectedLanguage: (languageId) =>
        set({ selectedLanguageId: languageId }),
    }),
    {
      name: "fluentflow-language-state",
      onRehydrateStorage: (state) => (_, error) => {
        if (error) {
          console.warn("Failed to hydrate language state", error);
        }

        state.setHasHydrated(true);
      },
      partialize: (state) => ({
        selectedLanguageId: state.selectedLanguageId,
      }),
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? serverStorage : AsyncStorage,
      ),
    },
  ),
);
