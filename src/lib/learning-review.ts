import { lessonsById } from "@/data/lessons";
import {
  MAX_REVIEW_STRENGTH,
  type ReviewProgress,
} from "@/store/progress-store";
import type { LanguageId, Lesson } from "@/types/learning";

const DAY_MS = 24 * 60 * 60 * 1000;

// A single practiceable item: one chunk the learner has met in a lesson, plus
// the identity we use to remember how well they know it.
export type ReviewTarget = {
  id: string; // "<lessonId>:<chunkId>"
  lessonId: string;
  languageId: LanguageId;
  term: string; // target-language text
  translation: string;
  pronunciation?: string;
};

// The compact learner snapshot the AI tutor receives so its replies build on
// what the learner has actually studied and gently reinforce their weak spots.
export type TutorPersonalization = {
  completedLessonIds: string[];
  learnedChunks: { term: string; translation: string }[];
  weakChunks: { term: string; translation: string }[];
  dueCount: number;
};

export function makeReviewId(lessonId: string, chunkId: string): string {
  return `${lessonId}:${chunkId}`;
}

// Build the review targets for one lesson. Migrated lessons expose real chunks;
// legacy lessons fall back to their vocabulary + phrases so nothing is lost.
export function getReviewTargetsForLesson(lesson: Lesson): ReviewTarget[] {
  const source =
    lesson.pedagogy?.targetChunks ?? [
      ...lesson.vocabulary.map((item) => ({
        id: item.id,
        text: item.term,
        translation: item.translation,
        pronunciation: item.pronunciation,
      })),
      ...lesson.phrases.map((item) => ({
        id: item.id,
        text: item.text,
        translation: item.translation,
        pronunciation: item.pronunciation,
      })),
    ];

  return source.map((item) => ({
    id: makeReviewId(lesson.id, item.id),
    lessonId: lesson.id,
    languageId: lesson.languageId,
    term: item.text,
    translation: item.translation,
    pronunciation: "pronunciation" in item ? item.pronunciation : undefined,
  }));
}

export function findReviewTarget(reviewId: string): ReviewTarget | null {
  const separatorIndex = reviewId.indexOf(":");
  if (separatorIndex <= 0) return null;

  const lesson = lessonsById[reviewId.slice(0, separatorIndex)];
  if (!lesson) return null;

  return (
    getReviewTargetsForLesson(lesson).find((target) => target.id === reviewId) ??
    null
  );
}

export function getReviewTargetsForCompletedLessons({
  completedLessonIds,
  languageId,
}: {
  completedLessonIds: string[];
  languageId: LanguageId;
}): ReviewTarget[] {
  return completedLessonIds.flatMap((lessonId) => {
    const lesson = lessonsById[lessonId];
    return lesson?.languageId === languageId
      ? getReviewTargetsForLesson(lesson)
      : [];
  });
}

// A target is due when we've never tested it or its scheduled time has passed.
export function isDue(progress: ReviewProgress | undefined, now = Date.now()): boolean {
  return !progress || progress.dueAt <= now;
}

// Higher = more urgent. Missed items (lapses) and weakly-known items rank above
// brand-new ones, and overdue items edge ahead of just-due ones.
export function getReviewPriority(
  progress: ReviewProgress | undefined,
  now = Date.now(),
): number {
  if (!progress) return 2; // new: worth practicing, below items they've struggled with
  const overdueDays = Math.max(0, (now - progress.dueAt) / DAY_MS);
  return (
    progress.lapses * 3 +
    (MAX_REVIEW_STRENGTH - progress.strength) +
    Math.min(overdueDays, 5)
  );
}

// The items to practice right now, most-urgent first.
export function getDueReviewTargets({
  completedLessonIds,
  languageId,
  now = Date.now(),
  reviewProgress,
}: {
  completedLessonIds: string[];
  languageId: LanguageId;
  now?: number;
  reviewProgress: Record<string, ReviewProgress>;
}): ReviewTarget[] {
  return getReviewTargetsForCompletedLessons({ completedLessonIds, languageId })
    .filter((target) => isDue(reviewProgress[target.id], now))
    .sort(
      (left, right) =>
        getReviewPriority(reviewProgress[right.id], now) -
        getReviewPriority(reviewProgress[left.id], now),
    );
}

// Items the learner has actually missed at least once — their real weak spots.
export function getWeakReviewTargets({
  completedLessonIds,
  languageId,
  reviewProgress,
}: {
  completedLessonIds: string[];
  languageId: LanguageId;
  reviewProgress: Record<string, ReviewProgress>;
}): ReviewTarget[] {
  return getReviewTargetsForCompletedLessons({ completedLessonIds, languageId })
    .filter((target) => (reviewProgress[target.id]?.lapses ?? 0) > 0)
    .sort(
      (left, right) =>
        getReviewPriority(reviewProgress[right.id]) -
        getReviewPriority(reviewProgress[left.id]),
    );
}

// Distinct helper so both practice and the tutor share the same de-dup rule:
// keep the first occurrence of each term.
function dedupeByTerm(targets: ReviewTarget[]): ReviewTarget[] {
  const seen = new Set<string>();
  const result: ReviewTarget[] = [];
  for (const target of targets) {
    const key = target.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(target);
  }
  return result;
}

// Compact snapshot for the AI tutor: what the learner has learned + where they
// are weak, so replies can reinforce real material instead of generic phrases.
export function buildTutorPersonalization({
  completedLessonIds,
  languageId,
  reviewProgress,
  now = Date.now(),
}: {
  completedLessonIds: string[];
  languageId: LanguageId;
  reviewProgress: Record<string, ReviewProgress>;
  now?: number;
}): TutorPersonalization {
  const languageLessonIds = completedLessonIds.filter(
    (id) => lessonsById[id]?.languageId === languageId,
  );

  const learned = dedupeByTerm(
    getReviewTargetsForCompletedLessons({
      completedLessonIds: languageLessonIds,
      languageId,
    }),
  ).slice(0, 24);

  const weak = dedupeByTerm(
    getWeakReviewTargets({
      completedLessonIds: languageLessonIds,
      languageId,
      reviewProgress,
    }),
  ).slice(0, 8);

  const dueCount = getDueReviewTargets({
    completedLessonIds: languageLessonIds,
    languageId,
    now,
    reviewProgress,
  }).length;

  return {
    completedLessonIds: languageLessonIds,
    learnedChunks: learned.map((t) => ({
      term: t.term,
      translation: t.translation,
    })),
    weakChunks: weak.map((t) => ({ term: t.term, translation: t.translation })),
    dueCount,
  };
}
