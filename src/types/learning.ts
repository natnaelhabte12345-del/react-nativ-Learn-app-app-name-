export type LanguageLevel = "beginner" | "elementary";

export type LanguageContentStatus = "available" | "preview";

export type LanguageId =
  | "spanish"
  | "french"
  | "japanese"
  | "korean"
  | "german"
  | "chinese";

export type UnitId = string;

export type LessonId = string;

export type LessonImageKey =
  | "lessonGreetings"
  | "lessonDailyLife"
  | "lessonCafe"
  | "lessonTravel"
  | "lessonShopping"
  | "lessonFamily";

export type ActivityType =
  | "vocabulary"
  | "phrase"
  | "listening"
  | "speaking"
  | "translation"
  | "multiple-choice";

export type LearningLanguage = {
  id: LanguageId;
  name: string;
  nativeName: string;
  flagEmoji: string;
  accentColor: string;
  description: string;
  learnerCountLabel: string;
  startingLevel: LanguageLevel;
  contentStatus: LanguageContentStatus;
};

export type LearningUnit = {
  id: UnitId;
  languageId: LanguageId;
  title: string;
  description: string;
  order: number;
  lessonIds: LessonId[];
};

export type VocabularyItem = {
  id: string;
  term: string;
  translation: string;
  pronunciation: string;
  example?: string;
};

export type PhraseItem = {
  id: string;
  text: string;
  translation: string;
  pronunciation: string;
  context: string;
};

export type LessonGoal = {
  id: string;
  title: string;
  description: string;
};

export type ActivityOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type LessonActivity = {
  id: string;
  type: ActivityType;
  prompt: string;
  answer: string;
  vocabularyId?: string;
  phraseId?: string;
  options?: ActivityOption[];
};

export type AITeacherPrompt = {
  mode: "audio" | "vision-agent-audio";
  scenario: string;
  voiceStyle: string;
  systemPrompt: string;
  openingLine: string;
  correctionStyle: string;
  targetPhrases: string[];
};

export type CEFRLevel = "A1" | "A2" | "B1" | "B2";

// A "chunk" is the real unit of fluency: a short usable phrase/collocation,
// not an isolated word (e.g. "me pone un café" rather than just "café").
export type Chunk = {
  id: string;
  text: string;
  translation: string;
  pronunciation?: string;
};

// A line in the modeled-input dialogue the learner hears before producing.
export type DialogueLine = {
  speaker: "a" | "b";
  text: string;
  translation: string;
};

// A guided-retrieval prompt: an English cue, the expected target-language
// answer, and an optional sentence-starter scaffold (faded out in later lessons).
export type RetrievalPrompt = {
  id: string;
  cue: string;
  expected: string;
  scaffold?: string;
};

// The free-production roleplay that closes each lesson.
export type FreeTask = {
  goal: string;
  twist?: string;
  successCriteria: string[];
};

// The evidence-based 5-phase lesson: situation hook -> modeled input ->
// guided retrieval (with recasting) -> embedded review -> free task.
// Optional on Lesson so existing lessons remain valid while content is migrated.
export type LessonPedagogy = {
  cefrLevel: CEFRLevel;
  canDo: string;
  situationHook: string;
  dialogue: DialogueLine[];
  targetChunks: Chunk[];
  guidedRetrieval: RetrievalPrompt[];
  // Chunks from earlier lessons to resurface naturally (spaced retrieval).
  // Denormalized so the AI agent receives them without extra lookups.
  reviewChunks: Chunk[];
  freeTask: FreeTask;
};

export type Lesson = {
  id: LessonId;
  unitId: UnitId;
  languageId: LanguageId;
  title: string;
  description: string;
  imageKey: LessonImageKey;
  xpReward: number;
  estimatedMinutes: number;
  goals: LessonGoal[];
  vocabulary: VocabularyItem[];
  phrases: PhraseItem[];
  activities: LessonActivity[];
  aiTeacherPrompt: AITeacherPrompt;
  // Present on lessons migrated to the 5-phase model; absent on legacy lessons.
  pedagogy?: LessonPedagogy;
};
