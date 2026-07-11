import { getReviewTargetsForLesson, makeReviewId } from "@/lib/learning-review";
import { lessonsByLanguageId } from "@/data/lessons";
import type { LanguageId, Lesson } from "@/types/learning";

// A Duolingo-style lesson is a short sequence of varied exercises generated from
// the lesson's own chunks + guided-retrieval prompts. Interleaving recognition
// (match/choose) with production (build) is what makes practice stick, and every
// answer feeds the spaced-repetition store via the reviewId(s) it carries.

export type MatchPair = { id: string; term: string; translation: string };

export type MatchExercise = {
  kind: "match";
  id: string;
  reviewIds: string[];
  pairs: MatchPair[];
};

export type ChooseOption = { id: string; text: string; correct: boolean };

export type ChooseExercise = {
  kind: "choose";
  id: string;
  reviewId: string;
  question: string;
  prompt: string; // the word/phrase being asked about
  promptSub?: string; // pronunciation hint, shown small
  options: ChooseOption[];
};

export type BuildExercise = {
  kind: "build";
  id: string;
  reviewId?: string;
  cue: string; // English instruction, e.g. "Ask where the station is"
  expected: string; // the target-language answer
  bank: string[]; // scrambled word tokens (answer words + a few distractors)
};

export type Exercise = MatchExercise | ChooseExercise | BuildExercise;

type Chunk = { id: string; text: string; translation: string; pronunciation?: string };

const MAX_EXERCISES = 10;
const MATCH_PAIR_COUNT = 5;
const CHOOSE_OPTION_COUNT = 4;

export function buildLessonExercises(lesson: Lesson): Exercise[] {
  const chunks = getChunks(lesson);
  if (chunks.length === 0) return [];

  const pool = buildTermPool(lesson.languageId, chunks);
  const exercises: Exercise[] = [];

  // 1) Warm-up: match a handful of pairs (pure recognition).
  const matchChunks = chunks.slice(0, MATCH_PAIR_COUNT);
  if (matchChunks.length >= 2) {
    exercises.push({
      kind: "match",
      id: `${lesson.id}-match`,
      reviewIds: matchChunks.map((c) => makeReviewId(lesson.id, c.id)),
      pairs: matchChunks.map((c) => ({
        id: c.id,
        term: c.text,
        translation: c.translation,
      })),
    });
  }

  // 2) One multiple-choice per chunk, alternating direction for variety.
  chunks.forEach((chunk, index) => {
    const toEnglish = index % 2 === 0;
    exercises.push(
      buildChooseExercise(lesson, chunk, pool, toEnglish),
    );
  });

  // 3) Production: build a couple of full phrases from guided-retrieval prompts.
  const retrieval = lesson.pedagogy?.guidedRetrieval ?? [];
  for (const prompt of retrieval.slice(0, 3)) {
    const build = buildBuildExercise(lesson, prompt.cue, prompt.expected, chunks);
    if (build) exercises.push(build);
  }

  // Interleave choose/build after the match warm-up, then cap the length so a
  // lesson stays short and finishable.
  return orderExercises(exercises).slice(0, MAX_EXERCISES);
}

function getChunks(lesson: Lesson): Chunk[] {
  if (lesson.pedagogy?.targetChunks.length) {
    return lesson.pedagogy.targetChunks.map((c) => ({
      id: c.id,
      text: c.text,
      translation: c.translation,
      pronunciation: c.pronunciation,
    }));
  }
  return lesson.vocabulary.map((v) => ({
    id: v.id,
    text: v.term,
    translation: v.translation,
    pronunciation: v.pronunciation,
  }));
}

type PoolEntry = { id: string; term: string; translation: string };

function buildTermPool(languageId: LanguageId, chunks: Chunk[]): PoolEntry[] {
  const fromLanguage = (lessonsByLanguageId[languageId] ?? []).flatMap((lesson) =>
    getReviewTargetsForLesson(lesson).map((t) => ({
      id: t.id,
      term: t.term,
      translation: t.translation,
    })),
  );
  const fromChunks = chunks.map((c) => ({
    id: c.id,
    term: c.text,
    translation: c.translation,
  }));
  return dedupeById([...fromLanguage, ...fromChunks]);
}

function buildChooseExercise(
  lesson: Lesson,
  chunk: Chunk,
  pool: PoolEntry[],
  toEnglish: boolean,
): ChooseExercise {
  const correctText = toEnglish ? chunk.translation : chunk.text;
  const field = toEnglish ? "translation" : "term";
  const distractors = pickDistractors(pool, field, correctText, chunk.id);

  const options = shuffle([
    { id: `${chunk.id}-correct`, text: correctText, correct: true },
    ...distractors.map((text, i) => ({
      id: `${chunk.id}-d${i}`,
      text,
      correct: false,
    })),
  ]);

  return {
    kind: "choose",
    id: `${lesson.id}-choose-${chunk.id}`,
    reviewId: makeReviewId(lesson.id, chunk.id),
    question: toEnglish ? "What does this mean?" : "Select the correct translation",
    prompt: toEnglish ? chunk.text : chunk.translation,
    promptSub: toEnglish ? chunk.pronunciation : undefined,
    options,
  };
}

function buildBuildExercise(
  lesson: Lesson,
  cue: string,
  expected: string,
  chunks: Chunk[],
): BuildExercise | null {
  const answerTokens = tokenize(expected);
  if (answerTokens.length < 2) return null;

  // A couple of plausible extra words the learner must NOT use, drawn from other
  // chunks in the lesson, so the bank isn't a giveaway.
  const distractorTokens = chunks
    .flatMap((c) => tokenize(c.text))
    .filter((token) => !answerTokens.some((a) => sameToken(a, token)))
    .slice(0, 2);

  // Try to attribute the phrase to a chunk so the answer still trains a review
  // target (match by the first content word appearing in a chunk's text).
  const relatedChunk = chunks.find((c) =>
    tokenize(c.text).some((t) => answerTokens.some((a) => sameToken(a, t))),
  );

  return {
    kind: "build",
    id: `${lesson.id}-build-${slug(expected)}`,
    reviewId: relatedChunk ? makeReviewId(lesson.id, relatedChunk.id) : undefined,
    cue,
    expected,
    bank: shuffle([...answerTokens, ...distractorTokens]),
  };
}

// Interleave: match first (if present), then alternate the remaining choose/build
// exercises so learners don't get a run of the same format.
function orderExercises(exercises: Exercise[]): Exercise[] {
  const match = exercises.filter((e) => e.kind === "match");
  const chooses = exercises.filter((e) => e.kind === "choose");
  const builds = exercises.filter((e) => e.kind === "build");

  const interleaved: Exercise[] = [];
  let bi = 0;
  chooses.forEach((choose, index) => {
    interleaved.push(choose);
    // Drop a build in after roughly every two choose exercises.
    if (index % 2 === 1 && bi < builds.length) {
      interleaved.push(builds[bi++]);
    }
  });
  while (bi < builds.length) interleaved.push(builds[bi++]);

  return [...match, ...interleaved];
}

// ─── helpers ────────────────────────────────────────────────────────────────

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[¿?¡!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(phrase: string): string[] {
  return phrase.split(/\s+/).filter(Boolean);
}

function sameToken(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}

function pickDistractors(
  pool: PoolEntry[],
  field: "term" | "translation",
  correctText: string,
  targetId: string,
): string[] {
  const seen = new Set<string>([correctText.toLowerCase()]);
  const candidates = shuffle(pool.filter((entry) => entry.id !== targetId));
  const result: string[] = [];

  for (const entry of candidates) {
    const text = entry[field];
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= CHOOSE_OPTION_COUNT - 1) break;
  }
  return result;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
