import type { LanguageId, LearningUnit } from "@/types/learning";

export const units = [
  {
    id: "spanish-basics-1",
    languageId: "spanish",
    title: "Spanish Basics",
    description: "Meet people, say hello, and answer simple questions.",
    order: 1,
    lessonIds: ["spanish-greetings"],
  },
  {
    id: "spanish-food-1",
    languageId: "spanish",
    title: "Cafe Spanish",
    description: "Order a drink and use polite cafe phrases.",
    order: 2,
    lessonIds: ["spanish-cafe-order"],
  },
  {
    id: "french-basics-1",
    languageId: "french",
    title: "French Basics",
    description: "Start conversations with polite beginner French.",
    order: 1,
    lessonIds: ["french-greetings"],
  },
  {
    id: "french-cafe-1",
    languageId: "french",
    title: "Cafe French",
    description: "Ask for coffee, water, and please.",
    order: 2,
    lessonIds: ["french-cafe-order"],
  },
  {
    id: "japanese-basics-1",
    languageId: "japanese",
    title: "Japanese Basics",
    description: "Use romanized greetings and a first self-introduction.",
    order: 1,
    lessonIds: ["japanese-greetings"],
  },
  {
    id: "korean-basics-1",
    languageId: "korean",
    title: "Korean Basics",
    description: "Practice friendly greetings and simple thanks.",
    order: 1,
    lessonIds: ["korean-greetings"],
  },
] as const satisfies LearningUnit[];

export const unitsByLanguageId = units.reduce(
  (groups, unit) => {
    groups[unit.languageId] = [...(groups[unit.languageId] ?? []), unit];
    return groups;
  },
  {} as Partial<Record<LanguageId, ((typeof units)[number])[]>>,
);
