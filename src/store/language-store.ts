import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createAppPersistStorage } from "@/lib/storage";
import type { LanguageId, TrackId } from "@/types/learning";

type LanguageState = {
  hasHydrated: boolean;
  // The language the learner already speaks (what the app explains things in).
  nativeLanguageId: string | null;
  // The language they're learning.
  selectedLanguageId: LanguageId | null;
  // The goal/track they picked (A1 basics, A2, Travel …) — scopes the content.
  trackId: TrackId | null;
  clearSelectedLanguage: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setNativeLanguage: (languageId: string) => void;
  setSelectedLanguage: (languageId: LanguageId) => void;
  setTrack: (trackId: TrackId) => void;
};

// The next onboarding screen the learner still needs, or null once they've
// chosen a native language, a target language, and a track.
export function selectOnboardingHref(state: LanguageState): string | null {
  if (!state.nativeLanguageId) return "/native-language";
  if (!state.selectedLanguageId) return "/language-selection";
  if (!state.trackId) return "/track-selection";
  return null;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      nativeLanguageId: null,
      selectedLanguageId: null,
      trackId: null,
      clearSelectedLanguage: () => set({ selectedLanguageId: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setNativeLanguage: (languageId) => set({ nativeLanguageId: languageId }),
      setSelectedLanguage: (languageId) =>
        set({ selectedLanguageId: languageId }),
      setTrack: (trackId) => set({ trackId }),
    }),
    {
      name: "fluentflow-language-state",
      onRehydrateStorage: (state) => (rehydratedState, error) => {
        if (error) {
          console.warn("Failed to hydrate language state", error);
        }

        // Mark the store as hydrated once rehydration completes (regardless of whether data was present)
        state.setHasHydrated(true);
      },
      partialize: (state) => ({
        nativeLanguageId: state.nativeLanguageId,
        selectedLanguageId: state.selectedLanguageId,
        trackId: state.trackId,
      }),
      storage: createAppPersistStorage(),
    },
  ),
);
