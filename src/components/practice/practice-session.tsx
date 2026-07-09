import { usePostHog } from "posthog-react-native";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { lessonsByLanguageId } from "@/data/lessons";
import { trackPracticeCompleted } from "@/lib/analytics";
import { getReviewTargetsForLesson, type ReviewTarget } from "@/lib/learning-review";
import { useProgressStore } from "@/store/progress-store";
import type { LanguageId } from "@/types/learning";

// How many questions one session runs at most, so a review stays short and
// finishable (spaced repetition works best in small, frequent doses).
const MAX_QUESTIONS = 10;
const OPTION_COUNT = 4;

type Direction = "toEnglish" | "toTarget";

type Option = {
  id: string;
  text: string;
  isCorrect: boolean;
};

type Question = {
  target: ReviewTarget;
  direction: Direction;
  promptLabel: string;
  prompt: string;
  options: Option[];
};

type PracticeSessionProps = {
  targets: ReviewTarget[];
  languageId: LanguageId;
  mode?: "lesson" | "review";
  onDone: () => void;
};

export function PracticeSession({
  targets,
  languageId,
  mode = "review",
  onDone,
}: PracticeSessionProps) {
  const posthog = usePostHog();
  const recordReviewResult = useProgressStore((state) => state.recordReviewResult);
  const recordActivity = useProgressStore((state) => state.recordActivity);

  // Build the question set once per target list. `sessionTargets` changes only
  // when the caller hands us a new list (e.g. "review your misses").
  const [sessionTargets, setSessionTargets] = useState(targets);
  const questions = useMemo(
    () => buildQuestions(sessionTargets, languageId),
    [sessionTargets, languageId],
  );

  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<ReviewTarget[]>([]);
  const [finished, setFinished] = useState(false);

  const question = questions[index];

  function handleSelect(option: Option) {
    if (selectedId || !question) return;
    setSelectedId(option.id);
    recordReviewResult(question.target.id, option.isCorrect);
    if (option.isCorrect) {
      setCorrectCount((count) => count + 1);
    } else {
      setMissed((prev) => [...prev, question.target]);
    }
  }

  function handleContinue() {
    if (index + 1 >= questions.length) {
      recordActivity();
      trackPracticeCompleted(posthog, {
        language: languageId,
        mode,
        total: questions.length,
        correct: correctCount,
        missed: missed.length,
      });
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelectedId(null);
  }

  function restartWithMisses() {
    setSessionTargets(missed);
    setIndex(0);
    setSelectedId(null);
    setCorrectCount(0);
    setMissed([]);
    setFinished(false);
  }

  if (questions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-[16px] leading-[22px] font-poppins-medium text-[#6F7896]">
          Nothing to review yet. Finish a lesson to unlock practice.
        </Text>
        <PrimaryButton label="Back" onPress={onDone} />
      </View>
    );
  }

  if (finished) {
    return (
      <PracticeSummary
        correct={correctCount}
        missedCount={missed.length}
        onDone={onDone}
        onReviewMisses={missed.length > 0 ? restartWithMisses : undefined}
        total={questions.length}
      />
    );
  }

  const answered = selectedId !== null;

  return (
    <View className="flex-1">
      <ProgressBar current={index + (answered ? 1 : 0)} total={questions.length} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[12px] leading-[16px] font-poppins-semibold uppercase tracking-[1px] text-[#7D6BE8]">
          {question.promptLabel}
        </Text>
        <Text className="mt-3 text-[26px] leading-[34px] font-poppins-bold text-text-primary">
          {question.prompt}
        </Text>
        {question.target.pronunciation && question.direction === "toEnglish" ? (
          <Text className="mt-1 text-[14px] leading-[20px] font-poppins-regular text-[#9AA1B3]">
            {question.target.pronunciation}
          </Text>
        ) : null}

        <View className="mt-7 gap-y-[10px]">
          {question.options.map((option) => {
            const isSelected = selectedId === option.id;
            const showCorrect = answered && option.isCorrect;
            const showWrong = answered && isSelected && !option.isCorrect;

            return (
              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                className={`min-h-[56px] items-center justify-center rounded-[15px] border-2 px-4 py-3 ${
                  showCorrect
                    ? "border-[#25C636] bg-[#F0FBF1]"
                    : showWrong
                      ? "border-[#F25757] bg-[#FFF3F3]"
                      : isSelected
                        ? "border-[#9278FF] bg-[#F7F5FF]"
                        : "border-[#EEF1F7] bg-white"
                }`}
                disabled={answered}
                key={option.id}
                onPress={() => handleSelect(option)}
              >
                <Text
                  className={`text-center text-[16px] leading-[22px] font-poppins-semibold ${
                    showCorrect
                      ? "text-[#1B9B2A]"
                      : showWrong
                        ? "text-[#D63535]"
                        : "text-text-primary"
                  }`}
                >
                  {option.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {answered ? (
        <View style={styles.footer}>
          <FeedbackLine
            correctAnswer={question.options.find((o) => o.isCorrect)?.text ?? ""}
            isCorrect={question.options.find((o) => o.id === selectedId)?.isCorrect ?? false}
          />
          <PrimaryButton
            label={index + 1 >= questions.length ? "Finish" : "Continue"}
            onPress={handleContinue}
          />
        </View>
      ) : null}
    </View>
  );
}

function FeedbackLine({
  correctAnswer,
  isCorrect,
}: {
  correctAnswer: string;
  isCorrect: boolean;
}) {
  return (
    <View className="mb-3 flex-row items-center">
      <Text
        className={`text-[14px] leading-[20px] font-poppins-semibold ${
          isCorrect ? "text-[#1B9B2A]" : "text-[#D63535]"
        }`}
      >
        {isCorrect ? "Nice! " : `Answer: ${correctAnswer}`}
      </Text>
    </View>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <View className="h-[8px] w-full overflow-hidden rounded-full bg-[#EEE9FF]">
      <View
        className="h-full rounded-full bg-lingua-deep-purple"
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}

function PracticeSummary({
  correct,
  total,
  missedCount,
  onDone,
  onReviewMisses,
}: {
  correct: number;
  total: number;
  missedCount: number;
  onDone: () => void;
  onReviewMisses?: () => void;
}) {
  const allCorrect = missedCount === 0;
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View
        className="h-[84px] w-[84px] items-center justify-center rounded-full"
        style={{ backgroundColor: allCorrect ? "#F0FBF1" : "#F4F0FF" }}
      >
        <Text className="text-[40px]">{allCorrect ? "🎉" : "💪"}</Text>
      </View>
      <Text className="mt-5 text-[24px] leading-[30px] font-poppins-bold text-text-primary">
        {correct} / {total} correct
      </Text>
      <Text className="mt-2 text-center text-[15px] leading-[22px] font-poppins-regular text-[#6F7896]">
        {allCorrect
          ? "Perfect recall — these are moving into long-term memory."
          : `${missedCount} to sharpen. They'll come back sooner in your reviews.`}
      </Text>

      {onReviewMisses ? (
        <PrimaryButton label={`Review ${missedCount} misses`} onPress={onReviewMisses} />
      ) : null}
      <TouchableOpacity
        activeOpacity={0.82}
        className="mt-3 h-[52px] w-full items-center justify-center rounded-[16px] border border-[#E5E7EB] bg-white"
        onPress={onDone}
      >
        <Text className="text-[16px] font-poppins-semibold text-[#5E6785]">Done</Text>
      </TouchableOpacity>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      className="mt-3 h-[52px] w-full items-center justify-center rounded-[16px] bg-lingua-deep-purple"
      onPress={onPress}
      style={styles.primaryShadow}
    >
      <Text className="text-[16px] font-poppins-semibold text-white">{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Question building ──────────────────────────────────────────────────────

function buildQuestions(targets: ReviewTarget[], languageId: LanguageId): Question[] {
  const chosen = dedupeById(targets).slice(0, MAX_QUESTIONS);
  const pool = buildDistractorPool(languageId, chosen);

  return chosen.map((target, index) => {
    // Alternate direction for variety (recognition both ways builds recall).
    const direction: Direction = index % 2 === 0 ? "toEnglish" : "toTarget";
    const correctText = direction === "toEnglish" ? target.translation : target.term;
    const distractors = pickDistractors(pool, direction, correctText, target.id);

    const options = shuffle([
      { id: `${target.id}-correct`, text: correctText, isCorrect: true },
      ...distractors.map((text, i) => ({
        id: `${target.id}-d${i}`,
        text,
        isCorrect: false,
      })),
    ]);

    return {
      target,
      direction,
      promptLabel:
        direction === "toEnglish" ? "What does this mean?" : "How do you say this?",
      prompt: direction === "toEnglish" ? target.term : target.translation,
      options,
    };
  });
}

type PoolEntry = { term: string; translation: string; id: string };

function buildDistractorPool(languageId: LanguageId, chosen: ReviewTarget[]): PoolEntry[] {
  const fromLanguage = (lessonsByLanguageId[languageId] ?? []).flatMap((lesson) =>
    getReviewTargetsForLesson(lesson).map((t) => ({
      term: t.term,
      translation: t.translation,
      id: t.id,
    })),
  );
  const fromChosen = chosen.map((t) => ({
    term: t.term,
    translation: t.translation,
    id: t.id,
  }));
  return dedupeById([...fromLanguage, ...fromChosen]);
}

function pickDistractors(
  pool: PoolEntry[],
  direction: Direction,
  correctText: string,
  targetId: string,
): string[] {
  const field = direction === "toEnglish" ? "translation" : "term";
  const seen = new Set<string>([correctText.toLowerCase()]);
  const candidates = shuffle(pool.filter((entry) => entry.id !== targetId));
  const result: string[] = [];

  for (const entry of candidates) {
    const text = entry[field];
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= OPTION_COUNT - 1) break;
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

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const styles = StyleSheet.create({
  footer: {
    paddingTop: 4,
  },
  primaryShadow: {
    elevation: 4,
    shadowColor: "#321D93",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  scroll: {
    paddingBottom: 16,
    paddingTop: 22,
  },
});
