import Ionicons from "@expo/vector-icons/Ionicons";
import { usePostHog } from "posthog-react-native";
import { useMemo, useRef, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { trackLessonCompleted, trackPracticeCompleted } from "@/lib/analytics";
import {
  buildLessonExercises,
  normalizeAnswer,
  type BuildExercise,
  type ChooseExercise,
  type Exercise,
  type MatchExercise,
} from "@/lib/lesson-exercises";
import { useProgressStore } from "@/store/progress-store";
import type { Lesson } from "@/types/learning";

const PURPLE = "#5B3BF6";
const GREEN = "#21C16B";
const GREEN_BG = "#EAF9F0";
const RED = "#FF4D4F";
const RED_BG = "#FFF0F0";
const BORDER = "#E6E8F0";

type Token = { key: string; token: string };

// The learner's in-progress answer for the current exercise, lifted into the
// player so both the exercise view and the footer's CHECK button stay in sync.
type Answer =
  | { kind: "match" }
  | { kind: "choose"; selectedId: string | null }
  | { kind: "build"; placed: Token[]; bank: Token[] };

type LessonPlayerProps = {
  lesson: Lesson;
  onExit: () => void;
  onSpeak: () => void;
};

export function LessonPlayer({ lesson, onExit, onSpeak }: LessonPlayerProps) {
  const posthog = usePostHog();
  const recordReviewResult = useProgressStore((s) => s.recordReviewResult);
  const recordActivity = useProgressStore((s) => s.recordActivity);
  const completeLesson = useProgressStore((s) => s.completeLesson);

  const exercises = useMemo(() => buildLessonExercises(lesson), [lesson]);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer>(() => initAnswer(exercises[0]));
  // null = awaiting an answer, true/false = the checked result for this exercise.
  const [checked, setChecked] = useState<null | boolean>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const finalizedRef = useRef(false);

  const exercise = exercises[index];

  function recordResult(correct: boolean, reviewIds: string[]) {
    setChecked(correct);
    if (correct) setCorrectCount((c) => c + 1);
    for (const id of reviewIds) recordReviewResult(id, correct);
  }

  function handleCheck() {
    if (!exercise) return;
    const outcome = evaluate(exercise, answer);
    recordResult(outcome.correct, outcome.reviewIds);
  }

  function handleContinue() {
    const next = index + 1;
    if (next >= exercises.length) {
      finalizeLesson();
      return;
    }
    setIndex(next);
    setAnswer(initAnswer(exercises[next]));
    setChecked(null);
  }

  function finalizeLesson() {
    if (!finalizedRef.current) {
      finalizedRef.current = true;
      recordActivity();
      completeLesson(lesson.id, lesson.xpReward);
      trackLessonCompleted(posthog, {
        lesson_id: lesson.id,
        language: lesson.languageId,
        spoken_turns: 0,
        xp_reward: lesson.xpReward,
      });
      trackPracticeCompleted(posthog, {
        language: lesson.languageId,
        mode: "lesson",
        total: exercises.length,
        correct: correctCount,
        missed: exercises.length - correctCount,
      });
    }
    setFinished(true);
  }

  if (exercises.length === 0 || !exercise) {
    return (
      <SafeAreaView style={styles.safe}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[16px] font-poppins-medium text-[#6F7896]">
            This lesson has no practice content yet.
          </Text>
          <PrimaryButton label="Back" onPress={onExit} />
        </View>
      </SafeAreaView>
    );
  }

  if (finished) {
    return (
      <CompletionScreen
        correct={correctCount}
        onExit={onExit}
        onSpeak={onSpeak}
        total={exercises.length}
        xp={lesson.xpReward}
      />
    );
  }

  const ready = isReady(exercise, answer);

  return (
    <SafeAreaView style={styles.safe}>
      <ProgressHeader
        current={index + (checked !== null ? 1 : 0)}
        onExit={onExit}
        total={exercises.length}
      />

      <View className="flex-1">
        {exercise.kind === "match" ? (
          <MatchView
            exercise={exercise}
            key={exercise.id}
            onComplete={(ids) => recordResult(true, ids)}
            solved={checked !== null}
          />
        ) : exercise.kind === "choose" ? (
          <ChooseView
            answered={checked !== null}
            exercise={exercise}
            onSelect={(id) => setAnswer({ kind: "choose", selectedId: id })}
            selectedId={answer.kind === "choose" ? answer.selectedId : null}
          />
        ) : (
          <BuildView
            answered={checked !== null}
            bank={answer.kind === "build" ? answer.bank : []}
            exercise={exercise}
            onChange={(placed, bank) => setAnswer({ kind: "build", placed, bank })}
            placed={answer.kind === "build" ? answer.placed : []}
            wrong={checked === false}
          />
        )}
      </View>

      <FooterArea
        checked={checked}
        isLast={index + 1 >= exercises.length}
        kind={exercise.kind}
        onCheck={handleCheck}
        onContinue={handleContinue}
        ready={ready}
      />
    </SafeAreaView>
  );
}

// ─── Answer helpers ─────────────────────────────────────────────────────────

function initAnswer(exercise: Exercise | undefined): Answer {
  if (!exercise) return { kind: "match" };
  if (exercise.kind === "choose") return { kind: "choose", selectedId: null };
  if (exercise.kind === "build") {
    return {
      kind: "build",
      placed: [],
      bank: exercise.bank.map((token, i) => ({ key: `${i}-${token}`, token })),
    };
  }
  return { kind: "match" };
}

function isReady(exercise: Exercise, answer: Answer): boolean {
  if (exercise.kind === "choose") {
    return answer.kind === "choose" && answer.selectedId !== null;
  }
  if (exercise.kind === "build") {
    return answer.kind === "build" && answer.placed.length > 0;
  }
  return false; // match auto-completes
}

function evaluate(
  exercise: Exercise,
  answer: Answer,
): { correct: boolean; reviewIds: string[] } {
  if (exercise.kind === "choose" && answer.kind === "choose") {
    const option = exercise.options.find((o) => o.id === answer.selectedId);
    return { correct: Boolean(option?.correct), reviewIds: [exercise.reviewId] };
  }
  if (exercise.kind === "build" && answer.kind === "build") {
    const attempt = answer.placed.map((t) => t.token).join(" ");
    const correct =
      normalizeAnswer(attempt) === normalizeAnswer(exercise.expected);
    return { correct, reviewIds: exercise.reviewId ? [exercise.reviewId] : [] };
  }
  return { correct: false, reviewIds: [] };
}

// ─── Progress header ────────────────────────────────────────────────────────

function ProgressHeader({
  current,
  total,
  onExit,
}: {
  current: number;
  total: number;
  onExit: () => void;
}) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((current / total) * 100));
  return (
    <View className="flex-row items-center px-4 pb-2 pt-1">
      <TouchableOpacity
        accessibilityLabel="Close lesson"
        accessibilityRole="button"
        activeOpacity={0.7}
        className="mr-3 h-9 w-9 items-center justify-center"
        onPress={onExit}
      >
        <Ionicons color="#9AA1B3" name="close" size={26} />
      </TouchableOpacity>
      <View className="h-[16px] flex-1 overflow-hidden rounded-full bg-[#EEE9FF]">
        <View
          className="h-full justify-start rounded-full"
          style={{ backgroundColor: PURPLE, width: `${pct}%` }}
        >
          {/* Glossy highlight stripe, like Duolingo's progress bar. */}
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.35)",
              borderRadius: 3,
              height: 4,
              marginHorizontal: 7,
              marginTop: 3,
            }}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Match ──────────────────────────────────────────────────────────────────

function MatchView({
  exercise,
  solved,
  onComplete,
}: {
  exercise: MatchExercise;
  solved: boolean;
  onComplete: (reviewIds: string[]) => void;
}) {
  const columns = useMemo(() => {
    const left = shuffle(exercise.pairs.map((p) => ({ pairId: p.id, text: p.term })));
    const right = shuffle(
      exercise.pairs.map((p) => ({ pairId: p.id, text: p.translation })),
    );
    return { left, right };
  }, [exercise]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const completedRef = useRef(false);

  function tryMatch(leftId: string | null, rightId: string | null) {
    if (!leftId || !rightId) return;
    if (leftId === rightId) {
      const next = [...matched, leftId];
      setMatched(next);
      setSelectedLeft(null);
      setSelectedRight(null);
      if (next.length === exercise.pairs.length && !completedRef.current) {
        completedRef.current = true;
        onComplete(exercise.reviewIds);
      }
    } else {
      setWrong([leftId, rightId]);
      setTimeout(() => {
        setWrong([]);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 450);
    }
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Text className="mb-6 text-[22px] leading-[28px] font-poppins-bold text-text-primary">
        Tap the matching pairs
      </Text>
      <View className="flex-row justify-between">
        <View className="w-[47%] gap-y-[12px]">
          {columns.left.map((tile) => (
            <MatchTile
              key={`l-${tile.pairId}`}
              matched={matched.includes(tile.pairId)}
              onPress={() => {
                if (solved || matched.includes(tile.pairId)) return;
                setSelectedLeft(tile.pairId);
                tryMatch(tile.pairId, selectedRight);
              }}
              selected={selectedLeft === tile.pairId}
              text={tile.text}
              wrong={wrong.includes(tile.pairId) && selectedLeft === tile.pairId}
            />
          ))}
        </View>
        <View className="w-[47%] gap-y-[12px]">
          {columns.right.map((tile) => (
            <MatchTile
              key={`r-${tile.pairId}`}
              matched={matched.includes(tile.pairId)}
              onPress={() => {
                if (solved || matched.includes(tile.pairId)) return;
                setSelectedRight(tile.pairId);
                tryMatch(selectedLeft, tile.pairId);
              }}
              selected={selectedRight === tile.pairId}
              text={tile.text}
              wrong={wrong.includes(tile.pairId) && selectedRight === tile.pairId}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function MatchTile({
  text,
  selected,
  matched,
  wrong,
  onPress,
}: {
  text: string;
  selected: boolean;
  matched: boolean;
  wrong: boolean;
  onPress: () => void;
}) {
  const borderColor = wrong ? RED : matched ? GREEN : selected ? PURPLE : BORDER;
  const backgroundColor = wrong
    ? RED_BG
    : matched
      ? GREEN_BG
      : selected
        ? "#F3F0FF"
        : "#FFFFFF";
  const textColor = matched ? GREEN : wrong ? RED : "#1B2340";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={matched ? 1 : 0.8}
      disabled={matched}
      onPress={onPress}
      style={[styles.matchTile, { backgroundColor, borderColor }]}
    >
      <Text
        className="text-center text-[15px] leading-[20px] font-poppins-semibold"
        style={{ color: textColor, opacity: matched ? 0.55 : 1 }}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Choose (multiple choice) ───────────────────────────────────────────────

function ChooseView({
  exercise,
  selectedId,
  answered,
  onSelect,
}: {
  exercise: ChooseExercise;
  selectedId: string | null;
  answered: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-[13px] leading-[17px] font-poppins-semibold uppercase tracking-[1px] text-[#8E97B0]">
        {exercise.question}
      </Text>
      <Text className="mt-3 text-[28px] leading-[36px] font-poppins-bold text-text-primary">
        {exercise.prompt}
      </Text>
      {exercise.promptSub ? (
        <Text className="mt-1 text-[14px] font-poppins-regular text-[#9AA1B3]">
          {exercise.promptSub}
        </Text>
      ) : null}

      <View className="mt-8 gap-y-[12px]">
        {exercise.options.map((option) => {
          const isSelected = selectedId === option.id;
          const showCorrect = answered && option.correct;
          const showWrong = answered && isSelected && !option.correct;
          const borderColor = showCorrect
            ? GREEN
            : showWrong
              ? RED
              : isSelected
                ? PURPLE
                : BORDER;
          const backgroundColor = showCorrect
            ? GREEN_BG
            : showWrong
              ? RED_BG
              : isSelected
                ? "#F3F0FF"
                : "#FFFFFF";
          return (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              disabled={answered}
              key={option.id}
              onPress={() => onSelect(option.id)}
              style={[styles.optionButton, { backgroundColor, borderColor }]}
            >
              <Text
                className="text-center text-[16px] leading-[22px] font-poppins-semibold"
                style={{ color: showCorrect ? GREEN : showWrong ? RED : "#1B2340" }}
              >
                {option.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Build (word bank) ──────────────────────────────────────────────────────

function BuildView({
  exercise,
  placed,
  bank,
  answered,
  wrong,
  onChange,
}: {
  exercise: BuildExercise;
  placed: Token[];
  bank: Token[];
  answered: boolean;
  wrong: boolean;
  onChange: (placed: Token[], bank: Token[]) => void;
}) {
  function place(token: Token) {
    if (answered) return;
    onChange([...placed, token], bank.filter((t) => t.key !== token.key));
  }
  function unplace(token: Token) {
    if (answered) return;
    onChange(placed.filter((t) => t.key !== token.key), [...bank, token]);
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-[13px] leading-[17px] font-poppins-semibold uppercase tracking-[1px] text-[#8E97B0]">
        Build the sentence
      </Text>
      <Text className="mt-3 text-[20px] leading-[27px] font-poppins-bold text-text-primary">
        {exercise.cue}
      </Text>

      <View style={styles.answerLine}>
        {placed.length === 0 ? (
          <Text className="text-[14px] font-poppins-regular text-[#B9BECD]">
            Tap the words below
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-[8px]">
            {placed.map((token) => (
              <WordChip
                key={token.key}
                label={token.token}
                onPress={() => unplace(token)}
                variant="placed"
              />
            ))}
          </View>
        )}
      </View>

      {answered && wrong ? (
        <Text className="mt-3 text-[14px] font-poppins-semibold" style={{ color: GREEN }}>
          Answer: {exercise.expected}
        </Text>
      ) : null}

      <View className="mt-8 flex-row flex-wrap gap-[10px]">
        {bank.map((token) => (
          <WordChip
            key={token.key}
            label={token.token}
            onPress={() => place(token)}
            variant="bank"
          />
        ))}
      </View>
    </ScrollView>
  );
}

function WordChip({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: "bank" | "placed";
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.wordChip, variant === "placed" ? styles.wordChipPlaced : null]}
    >
      <Text className="text-[16px] leading-[22px] font-poppins-semibold text-[#1B2340]">
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function FooterArea({
  kind,
  checked,
  ready,
  isLast,
  onCheck,
  onContinue,
}: {
  kind: Exercise["kind"];
  checked: null | boolean;
  ready: boolean;
  isLast: boolean;
  onCheck: () => void;
  onContinue: () => void;
}) {
  // Match auto-completes, so there's no CHECK button until it reports a result.
  if (kind === "match" && checked === null) {
    return <View style={styles.footerSpacer} />;
  }

  if (checked !== null) {
    return (
      <View style={[styles.footer, { backgroundColor: checked ? GREEN_BG : RED_BG }]}>
        <View className="mb-3 flex-row items-center">
          <Ionicons
            color={checked ? GREEN : RED}
            name={checked ? "checkmark-circle" : "close-circle"}
            size={26}
          />
          <Text
            className="ml-2 text-[17px] font-poppins-bold"
            style={{ color: checked ? GREEN : RED }}
          >
            {checked ? "Nice!" : "Not quite"}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onContinue}
          style={[styles.checkButton, { backgroundColor: checked ? GREEN : RED }]}
        >
          <Text className="text-[16px] font-poppins-bold text-white">
            {isLast ? "Finish" : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.footer}>
      <TouchableOpacity
        activeOpacity={0.88}
        disabled={!ready}
        onPress={onCheck}
        style={[styles.checkButton, { backgroundColor: ready ? PURPLE : "#E5E7EB" }]}
      >
        <Text
          className="text-[16px] font-poppins-bold"
          style={{ color: ready ? "#FFFFFF" : "#9AA1B3" }}
        >
          CHECK
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Completion ─────────────────────────────────────────────────────────────

function CompletionScreen({
  correct,
  total,
  xp,
  onSpeak,
  onExit,
}: {
  correct: number;
  total: number;
  xp: number;
  onSpeak: () => void;
  onExit: () => void;
}) {
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
  return (
    <SafeAreaView style={styles.safe}>
      <View className="flex-1 items-center justify-center px-6">
        <Image
          resizeMode="contain"
          source={images.mascotWelcome}
          style={{ height: 130, width: 130 }}
        />
        <Text className="mt-4 text-[26px] leading-[32px] font-poppins-bold text-text-primary">
          Lesson complete!
        </Text>
        <Text className="mt-2 text-center text-[15px] leading-[22px] font-poppins-regular text-[#6F7896]">
          Now put these words to work — have a real conversation with Duo.
        </Text>

        <View className="mt-6 w-full flex-row gap-x-3">
          <StatCard color="#FFC800" label="XP" value={`+${xp}`} />
          <StatCard color={PURPLE} label="Accuracy" value={`${accuracy}%`} />
        </View>

        <View className="mt-8 w-full">
          <PrimaryButton icon="chatbubbles" label="Talk to Duo" onPress={onSpeak} />
          <TouchableOpacity
            activeOpacity={0.85}
            className="mt-3 h-[54px] items-center justify-center rounded-[16px] border border-[#E5E7EB] bg-white"
            onPress={onExit}
          >
            <Text className="text-[16px] font-poppins-semibold text-[#5E6785]">
              Back to path
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="flex-1 items-center rounded-[16px] border border-[#EEF1F7] bg-white py-4">
      <Text className="text-[22px] font-poppins-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="mt-1 text-[12px] font-poppins-semibold uppercase tracking-[1px] text-[#9AA1B3]">
        {label}
      </Text>
    </View>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.checkButton, { backgroundColor: PURPLE, marginTop: 12 }]}
    >
      {icon ? (
        <Ionicons color="#FFFFFF" name={icon} size={18} style={{ marginRight: 8 }} />
      ) : null}
      <Text className="text-[16px] font-poppins-bold text-white">{label}</Text>
    </TouchableOpacity>
  );
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
  answerLine: {
    borderBottomColor: BORDER,
    borderBottomWidth: 2,
    borderTopColor: BORDER,
    borderTopWidth: 2,
    justifyContent: "center",
    marginTop: 24,
    minHeight: 64,
    paddingVertical: 12,
  },
  checkButton: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    height: 54,
    justifyContent: "center",
  },
  footer: {
    borderTopColor: "#F0F0F5",
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  footerSpacer: {
    paddingBottom: 28,
  },
  matchTile: {
    alignItems: "center",
    borderBottomWidth: 4,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 60,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  optionButton: {
    alignItems: "center",
    borderBottomWidth: 4,
    borderRadius: 15,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  safe: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  scroll: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  wordChip: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 3,
    borderColor: BORDER,
    borderRadius: 13,
    borderWidth: 2,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  wordChipPlaced: {
    backgroundColor: "#F6F7FB",
  },
});
