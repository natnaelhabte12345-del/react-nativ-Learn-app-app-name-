import type { TrackId } from "@/types/learning";

export type Track = {
  id: TrackId;
  title: string;
  shortLabel: string;
  subtitle: string;
  icon: string; // Ionicons name
  accent: string;
};

// The learner picks one of these at onboarding. It scopes which lessons the
// Learn path shows. A1/A2 follow the CEFR levels tagged on each lesson's
// pedagogy; Travel is a themed cross-cut of the most useful "getting around"
// lessons. Ordered from most-beginner to most-advanced.
export const tracks: Track[] = [
  {
    id: "a1",
    title: "A1 · Get started",
    shortLabel: "A1",
    subtitle: "The absolute basics — greet people, order, and get by.",
    icon: "leaf",
    accent: "#5B3BF6",
  },
  {
    id: "a2",
    title: "A2 · Build up",
    shortLabel: "A2",
    subtitle: "Handle everyday situations with more detail.",
    icon: "trending-up",
    accent: "#4D8BFF",
  },
  {
    id: "travel",
    title: "Travel",
    shortLabel: "Travel",
    subtitle: "Get around, order, and ask for help abroad.",
    icon: "airplane",
    accent: "#21C16B",
  },
];

export const tracksById: Record<TrackId, Track> = Object.fromEntries(
  tracks.map((track) => [track.id, track]),
) as Record<TrackId, Track>;

export const defaultTrackId: TrackId = "a1";
