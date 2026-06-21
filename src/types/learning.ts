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
};
