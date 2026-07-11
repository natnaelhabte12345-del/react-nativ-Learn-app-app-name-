import { lessonsByLanguageId } from "@/data/lessons";
import { unitsByLanguageId } from "@/data/units";
import type { LanguageId, Lesson, TrackId } from "@/types/learning";

// The "getting around" cross-cut used for the Travel track (matched by the
// lesson id suffix so it works across languages).
const TRAVEL_SUFFIXES = [
  "travel-directions",
  "getting-around",
  "numbers-prices",
  "cafe-order",
  "restaurant",
  "shopping",
];

function isTravelLesson(lesson: Lesson): boolean {
  return (
    TRAVEL_SUFFIXES.some((suffix) => lesson.id.endsWith(suffix)) ||
    lesson.imageKey === "lessonTravel"
  );
}

function lessonLevel(lesson: Lesson): "A1" | "A2" | null {
  const level = lesson.pedagogy?.cefrLevel;
  return level === "A1" || level === "A2" ? level : null;
}

// Lessons for a language in their unit-defined teaching order.
function orderedLessons(languageId: LanguageId): Lesson[] {
  const units = unitsByLanguageId[languageId] ?? [];
  const order = units.flatMap((unit) => unit.lessonIds);
  const byId = new Map(
    (lessonsByLanguageId[languageId] ?? []).map((lesson) => [lesson.id, lesson]),
  );
  const seen = new Set<string>();
  const result: Lesson[] = [];

  for (const id of order) {
    const lesson = byId.get(id);
    if (lesson && !seen.has(id)) {
      seen.add(id);
      result.push(lesson);
    }
  }
  for (const lesson of lessonsByLanguageId[languageId] ?? []) {
    if (!seen.has(lesson.id)) {
      seen.add(lesson.id);
      result.push(lesson);
    }
  }
  return result;
}

// The ordered lessons that make up a track for a given language.
export function getTrackLessons(
  languageId: LanguageId,
  trackId: TrackId,
): Lesson[] {
  const all = orderedLessons(languageId);

  if (trackId === "travel") {
    const travel = all.filter(isTravelLesson);
    return travel.length > 0 ? travel : all;
  }

  const level = trackId === "a1" ? "A1" : "A2";
  const filtered = all.filter((lesson) => lessonLevel(lesson) === level);

  // Legacy lessons without a CEFR tag still count as A1 beginner content so the
  // A1 track is never empty.
  if (trackId === "a1" && filtered.length === 0) {
    return all.filter((lesson) => lessonLevel(lesson) !== "A2");
  }
  return filtered;
}
