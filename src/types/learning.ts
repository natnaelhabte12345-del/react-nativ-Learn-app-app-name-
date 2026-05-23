export type LanguageLevel = "beginner" | "elementary";

export type LanguageContentStatus = "available" | "preview";

export type LanguageId =
  | "spanish"
  | "french"
  | "japanese"
  | "korean"
  | "german"
  | "chinese";

export type UnitId =
  | "spanish-basics-1"
  | "spanish-food-1"
  | "french-basics-1"
  | "french-cafe-1"
  | "japanese-basics-1"
  | "korean-basics-1";

export type LessonId =
  | "spanish-greetings"
  | "spanish-cafe-order"
  | "french-greetings"
  | "french-cafe-order"
  | "japanese-greetings"
  | "korean-greetings";

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
  xpReward: number;
  estimatedMinutes: number;
  goals: LessonGoal[];
  vocabulary: VocabularyItem[];
  phrases: PhraseItem[];
  activities: LessonActivity[];
  aiTeacherPrompt: AITeacherPrompt;
};
