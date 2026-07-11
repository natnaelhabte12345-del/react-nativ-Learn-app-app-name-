import type { LanguageId, LearningUnit } from "@/types/learning";

export const units = [
  {
    id: "spanish-cafe-path-3",
    languageId: "spanish",
    title: "Spanish Essentials",
    description: "Practice everyday Spanish: greetings, caf\u00E9s, travel, shopping, family, prices, restaurants, directions, and small talk.",
    order: 2,
    lessonIds: [
      "spanish-greetings",
      "spanish-daily-life",
      "spanish-cafe-order",
      "spanish-travel-directions",
      "spanish-shopping",
      "spanish-family-friends",
      "spanish-numbers-prices",
      "spanish-restaurant",
      "spanish-getting-around",
      "spanish-small-talk",
    ],
  },
  {
    id: "french-cafe-path-3",
    languageId: "french",
    title: "At the Caf\u00E9",
    description: "Practice useful French across greetings, cafes, travel, shopping, and family.",
    order: 2,
    lessonIds: [
      "french-greetings",
      "french-daily-life",
      "french-cafe-order",
      "french-travel-directions",
      "french-shopping",
      "french-family-friends",
    ],
  },
  {
    id: "japanese-cafe-path-3",
    languageId: "japanese",
    title: "At the Caf\u00E9",
    description: "Use romanized Japanese for greetings, cafes, travel, shopping, and family.",
    order: 2,
    lessonIds: [
      "japanese-greetings",
      "japanese-daily-life",
      "japanese-cafe-order",
      "japanese-travel-directions",
      "japanese-shopping",
      "japanese-family-friends",
    ],
  },
  {
    id: "korean-cafe-path-3",
    languageId: "korean",
    title: "At the Caf\u00E9",
    description: "Use romanized Korean for greetings, cafes, travel, shopping, and family.",
    order: 2,
    lessonIds: [
      "korean-greetings",
      "korean-daily-life",
      "korean-cafe-order",
      "korean-travel-directions",
      "korean-shopping",
      "korean-family-friends",
    ],
  },
  {
    id: "german-cafe-path-3",
    languageId: "german",
    title: "German Essentials",
    description: "Practice beginner German: greetings, caf\u00E9s, travel, shopping, family, prices, restaurants, directions, and small talk.",
    order: 2,
    lessonIds: [
      "german-greetings",
      "german-daily-life",
      "german-cafe-order",
      "german-travel-directions",
      "german-shopping",
      "german-family-friends",
      "german-numbers-prices",
      "german-time",
      "german-restaurant",
      "german-getting-around",
      "german-small-talk",
    ],
  },
  {
    id: "chinese-cafe-path-3",
    languageId: "chinese",
    title: "At the Caf\u00E9",
    description: "Use pinyin Mandarin for greetings, cafes, travel, shopping, and family.",
    order: 2,
    lessonIds: [
      "chinese-greetings",
      "chinese-daily-life",
      "chinese-cafe-order",
      "chinese-travel-directions",
      "chinese-shopping",
      "chinese-family-friends",
    ],
  },
] as const satisfies LearningUnit[];

export const unitsByLanguageId = units.reduce(
  (groups, unit) => {
    groups[unit.languageId] = [...(groups[unit.languageId] ?? []), unit];
    return groups;
  },
  {} as Partial<Record<LanguageId, ((typeof units)[number])[]>>,
);
