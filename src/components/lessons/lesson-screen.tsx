import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { images } from "@/constants/images";
import { defaultLanguageId, languages } from "@/data/languages";
import { lessonsById } from "@/data/lessons";
import { defaultTrackId, tracksById, type Track } from "@/data/tracks";
import {
  getDueReviewTargets,
  getWeakReviewTargets,
  type ReviewTarget,
} from "@/lib/learning-review";
import { getTrackLessons } from "@/lib/tracks";
import { useLanguageStore } from "@/store/language-store";
import { useProgressStore } from "@/store/progress-store";
import type { LanguageId, Lesson } from "@/types/learning";

// A small, on-theme prop next to the mascot — like Duolingo scattering its owl
// and treasure chest along the path instead of leaving it bare. One emoji per
// language keeps this lightweight (no new assets/libraries needed).
const LANGUAGE_PROPS: Record<LanguageId, string> = {
  spanish: "🌮",
  french: "🥐",
  german: "🥨",
  japanese: "🍣",
  korean: "🍚",
  chinese: "🥟",
};

const CONTENT_MAX_WIDTH = 500;
const CONTENT_PADDING = 18;
const PURPLE = "#5B3BF6";
const PURPLE_LIGHT = "#6C4EF5";
const PURPLE_DEEP = "#4A2FD0";
const GOLD = "#FFC107";
const GOLD_DEEP = "#E0A500";
const LOCK = "#E7E9F2";
const LOCK_DEEP = "#D2D6E4";

type LessonStatus = "completed" | "inProgress" | "notStarted";
type LessonTab = "lessons" | "practice";

export function LessonScreen() {
  const { width } = useWindowDimensions();
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const trackId = useLanguageStore((state) => state.trackId) ?? defaultTrackId;
  const completedLessonIds = useProgressStore((state) => state.completedLessonIds);
  const [activeTab, setActiveTab] = useState<LessonTab>("lessons");

  // Lessons are scoped to the learner's chosen track (A1 / A2 / Travel), falling
  // back to A1 if the picked track happens to have no content for this language.
  const lessons = useMemo(() => {
    const scoped = getTrackLessons(selectedLanguageId, trackId);
    return scoped.length > 0 ? scoped : getTrackLessons(selectedLanguageId, "a1");
  }, [selectedLanguageId, trackId]);

  if (!hasHydrated) {
    return <AppLoadingScreen message="Loading lessons..." />;
  }

  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const innerWidth = contentWidth - CONTENT_PADDING * 2;

  if (lessons.length === 0) {
    return <AppLoadingScreen message="No lessons available yet." />;
  }

  const track = tracksById[trackId] ?? tracksById[defaultTrackId];
  const languageName =
    languages.find((language) => language.id === selectedLanguageId)?.name ?? "";
  const totalLessons = lessons.length;
  const activeLessonIndex = lessons.findIndex(
    (lesson) => !completedLessonIds.includes(lesson.id),
  );
  const currentIndex = activeLessonIndex === -1 ? totalLessons - 1 : activeLessonIndex;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ alignSelf: "center", width: contentWidth }}>
        <View className="px-[18px] pb-3 pt-1">
          <LessonTabs activeTab={activeTab} onChange={setActiveTab} width={innerWidth} />
        </View>
        {activeTab === "lessons" ? (
          <SectionBanner languageName={languageName} track={track} />
        ) : null}
      </View>

      {activeTab === "lessons" ? (
        <LessonPath
          activeLessonIndex={currentIndex}
          completedLessonIds={completedLessonIds}
          contentWidth={contentWidth}
          languageId={selectedLanguageId}
          lessons={lessons}
        />
      ) : (
        <ScrollView
          className="flex-1 bg-background"
          contentContainerStyle={[styles.scrollContent, { width: contentWidth }]}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-[18px]">
            <PracticeContent completedLessonIds={completedLessonIds} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Section banner (slim, Duolingo-style) ──────────────────────────────────

function SectionBanner({
  languageName,
  track,
}: {
  languageName: string;
  track: Track;
}) {
  return (
    <View className="px-[18px]">
      <View className="flex-row items-center rounded-[16px] px-5 py-3" style={styles.banner}>
        <View className="flex-1">
          <Text className="text-[11px] leading-[15px] font-poppins-bold uppercase tracking-[1.5px] text-[#D3C7FF]">
            {languageName ? `${languageName} · ${track.shortLabel}` : track.shortLabel}
          </Text>
          <Text className="mt-0.5 text-[17px] leading-[23px] font-poppins-bold text-white" numberOfLines={1}>
            {track.title}
          </Text>
        </View>
        <View className="ml-3 h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-[#7B62FF]">
          <Ionicons color="#FFFFFF" name={track.icon as never} size={19} />
        </View>
      </View>
    </View>
  );
}

// ─── Lesson path ────────────────────────────────────────────────────────────

function LessonPath({
  lessons,
  activeLessonIndex,
  completedLessonIds,
  contentWidth,
  languageId,
}: {
  lessons: Lesson[];
  activeLessonIndex: number;
  completedLessonIds: string[];
  contentWidth: number;
  languageId: LanguageId;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const currentNodeRef = useRef<View>(null);
  const didScrollRef = useRef(false);
  // Only one node's callout card is open at a time, and nothing is open by
  // default — the learner taps a node to reveal it, then taps START inside it.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Bring the active lesson node into view on open, so the learner never
  // lands on a screen where the current lesson is scrolled out of sight.
  function scrollToCurrent() {
    if (didScrollRef.current) return;
    const node = currentNodeRef.current;
    const scroll = scrollRef.current as unknown as {
      getScrollableNode?: () => number;
      scrollTo: (opts: { y: number; animated: boolean }) => void;
    } | null;
    if (!node || !scroll?.getScrollableNode) return;
    try {
      node.measureLayout(
        scroll.getScrollableNode(),
        (_x: number, y: number) => {
          didScrollRef.current = true;
          scroll.scrollTo({ y: Math.max(0, y - 90), animated: false });
        },
        () => undefined,
      );
    } catch {
      // measureLayout can throw before layout settles — safe to ignore.
    }
  }

  // Only render what the learner has reached: completed lessons + the current
  // one. Lessons further down the path aren't shown at all — no titles, no
  // preview — matching Duolingo, where the path never spoils what's ahead.
  const visibleLessons = lessons.slice(0, activeLessonIndex + 1);

  // Precompute each node's sway offset up front (with the current node forced
  // to 0) so the connector between two nodes can average them — otherwise the
  // line jumps straight to the next node's offset and the path looks broken.
  const offsets = visibleLessons.map((lesson, index) => {
    const status = getLessonStatus(lesson.id, index, activeLessonIndex, completedLessonIds);
    return status === "inProgress" ? 0 : SWAY[index % SWAY.length];
  });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={[styles.scrollContent, { width: contentWidth }]}
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
    >
      {/* Tapping empty space (not a node) closes whichever callout is open —
          taps on a node itself are captured by its own touchable first. */}
      <Pressable
        className="mt-4 items-center px-[18px]"
        onPress={() => setExpandedId(null)}
      >
        {visibleLessons.map((lesson, index) => {
          const status = getLessonStatus(
            lesson.id,
            index,
            activeLessonIndex,
            completedLessonIds,
          );
          const isCurrent = status === "inProgress";
          const connectorOffset =
            index === 0 ? 0 : (offsets[index - 1] + offsets[index]) / 2;
          const isLastVisible = index === visibleLessons.length - 1;
          // The node icon's vertical center within this item, used to line the
          // side decorations up with the node itself rather than the card below.
          const nodeCenterY = (index === 0 ? 0 : 26) + 41;

          return (
            <View
              key={lesson.id}
              onLayout={isCurrent ? scrollToCurrent : undefined}
              ref={isCurrent ? currentNodeRef : undefined}
              style={{ width: "100%", alignItems: "center" }}
            >
              {index !== 0 ? (
                <View style={{ transform: [{ translateX: connectorOffset }] }}>
                  <View style={styles.connector} />
                </View>
              ) : null}

              <LessonNode
                index={index}
                isExpanded={expandedId === lesson.id}
                lesson={lesson}
                offset={offsets[index]}
                onStart={() => router.push(`/lesson/${lesson.id}/session` as Href)}
                onToggleExpand={() =>
                  setExpandedId((current) => (current === lesson.id ? null : lesson.id))
                }
                status={status}
              />

              {/* Staggered, not paired: the reference (duolingo-refs/Home.png)
                  puts its treasure chest upper-left, level with the path node,
                  and its owl lower-right, level with the callout further down
                  — offset from each other, not mirrored on one line. Both sit
                  loose in the scene (no card/badge chrome around them) and are
                  sized close to the node itself, like the reference's chest. */}
              {isLastVisible ? (
                <>
                  <Text
                    style={{
                      fontSize: 60,
                      left: -8,
                      position: "absolute",
                      top: nodeCenterY - 38,
                    }}
                  >
                    {LANGUAGE_PROPS[languageId]}
                  </Text>
                  <Image
                    resizeMode="contain"
                    source={images.mascotWelcome}
                    style={[
                      styles.mascotImage,
                      { position: "absolute", right: -10, top: nodeCenterY + 95 },
                    ]}
                  />
                </>
              ) : null}
            </View>
          );
        })}
      </Pressable>
    </ScrollView>
  );
}

// A gentle left/right sway down the column so nodes read as a winding path.
// The current node stays centered so its callout card sits cleanly beneath it.
const SWAY = [0, 42, 60, 42, 0, -42, -60, -42];

function LessonNode({
  lesson,
  index,
  status,
  offset,
  isExpanded,
  onToggleExpand,
  onStart,
}: {
  lesson: Lesson;
  index: number;
  status: LessonStatus;
  offset: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStart: () => void;
}) {
  const isCurrent = status === "inProgress";
  const isDone = status === "completed";
  const isLocked = status === "notStarted";

  const face = isDone ? GOLD : isCurrent ? PURPLE_LIGHT : LOCK;
  const base = isDone ? GOLD_DEEP : isCurrent ? PURPLE_DEEP : LOCK_DEEP;
  const iconName = isDone ? "checkmark-sharp" : "star";
  const iconColor = isDone || isCurrent ? "#FFFFFF" : "#AEB4C6";

  return (
    <View className="items-center" style={{ transform: [{ translateX: offset }] }}>
      {/* The glossy 3D "stone" node. Locked nodes don't respond to taps —
          only the current lesson and completed ones (to replay) can open. */}
      <TouchableOpacity
        accessibilityLabel={
          isLocked
            ? `Lesson ${index + 1}: ${lesson.title} (locked)`
            : `Lesson ${index + 1}: ${lesson.title}`
        }
        accessibilityRole="button"
        activeOpacity={isLocked ? 1 : 0.85}
        disabled={isLocked}
        onPress={onToggleExpand}
        style={styles.nodeWrap}
      >
        {isCurrent ? <View style={styles.nodeRing} /> : null}
        <View style={[styles.nodeBase, { backgroundColor: base }]} />
        <View style={[styles.nodeFace, { backgroundColor: face }]}>
          <View style={styles.nodeGloss} />
          <Ionicons color={iconColor} name={iconName} size={30} />
        </View>
      </TouchableOpacity>

      {isExpanded && !isLocked ? (
        <StartCard
          index={index}
          isReplay={isDone}
          lesson={lesson}
          onStart={onStart}
        />
      ) : (
        <Text
          className="mt-2 max-w-[150px] text-center text-[12px] leading-[16px] font-poppins-semibold text-[#9AA1B3]"
          numberOfLines={2}
        >
          {lesson.title}
        </Text>
      )}
    </View>
  );
}

function StartCard({
  lesson,
  index,
  isReplay,
  onStart,
}: {
  lesson: Lesson;
  index: number;
  isReplay: boolean;
  onStart: () => void;
}) {
  const level = lesson.pedagogy?.cefrLevel;
  return (
    <View className="mt-[14px] w-[86%]" style={styles.startCard}>
      <View style={styles.startPointer} />
      <Text className="text-[17px] leading-[22px] font-poppins-bold text-white" numberOfLines={1}>
        {lesson.title}
      </Text>
      <Text className="mt-0.5 text-[12px] leading-[16px] font-poppins-medium text-[#D3C7FF]">
        Lesson {index + 1}
        {level ? ` · Level ${level}` : ""}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.9}
        onPress={onStart}
        style={styles.startButton}
      >
        <Text className="text-[15px] font-poppins-bold text-lingua-deep-purple">
          {isReplay ? "PRACTICE AGAIN" : `START +${lesson.xpReward} XP`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

type LessonTabsProps = {
  activeTab: LessonTab;
  onChange: (tab: LessonTab) => void;
  width: number;
};

function LessonTabs({ activeTab, onChange, width }: LessonTabsProps) {
  const tabWidth = width / 2;
  const indicator = useRef(
    new Animated.Value(activeTab === "lessons" ? 0 : 1),
  ).current;

  useEffect(() => {
    Animated.timing(indicator, {
      toValue: activeTab === "lessons" ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, indicator]);

  const indicatorWidth = Math.max(64, Math.round(tabWidth * 0.58));
  const baseOffset = (tabWidth - indicatorWidth) / 2;
  const translateX = indicator.interpolate({
    inputRange: [0, 1],
    outputRange: [baseOffset, tabWidth + baseOffset],
  });

  return (
    <View
      className="flex-row overflow-hidden rounded-[20px] bg-white"
      style={[styles.segmentedCard, styles.segmentedShadow]}
    >
      <TabButton
        isActive={activeTab === "lessons"}
        label="Lessons"
        onPress={() => onChange("lessons")}
      />
      <TabButton
        isActive={activeTab === "practice"}
        label="Practice"
        onPress={() => onChange("practice")}
      />

      <Animated.View
        className="absolute bottom-0 h-[4px] rounded-full bg-lingua-deep-purple"
        style={{ transform: [{ translateX }], width: indicatorWidth }}
      />
    </View>
  );
}

type TabButtonProps = {
  isActive: boolean;
  label: string;
  onPress: () => void;
};

function TabButton({ isActive, label, onPress }: TabButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      className="flex-1 items-center justify-center"
      onPress={onPress}
    >
      <Text
        className={`text-[16px] leading-[22px] ${
          isActive
            ? "font-poppins-semibold text-lingua-deep-purple"
            : "font-poppins-medium text-[#5E6785]"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Practice tab (spaced-repetition review) ────────────────────────────────

type PracticeContentProps = {
  completedLessonIds: string[];
};

function PracticeContent({ completedLessonIds }: PracticeContentProps) {
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const reviewProgress = useProgressStore((state) => state.reviewProgress);

  const languageCompleted = completedLessonIds.filter(
    (id) => lessonsById[id]?.languageId === selectedLanguageId,
  );

  if (languageCompleted.length === 0) {
    return (
      <View className="mt-[28px] items-center rounded-[20px] border border-[#EEF1F7] bg-white px-6 py-10">
        <Image
          className="h-[96px] w-[96px]"
          resizeMode="contain"
          source={images.mascotWelcome}
        />
        <Text className="mt-4 text-[18px] leading-[24px] font-poppins-semibold text-text-primary">
          Finish a lesson first
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-[21px] font-poppins-regular text-[#6F7896]">
          Complete at least one lesson to unlock personalized practice here.
        </Text>
      </View>
    );
  }

  const due = getDueReviewTargets({
    completedLessonIds,
    languageId: selectedLanguageId,
    reviewProgress,
  });
  const weak = getWeakReviewTargets({
    completedLessonIds,
    languageId: selectedLanguageId,
    reviewProgress,
  });

  return (
    <View className="mt-[20px]">
      <View
        className="overflow-hidden rounded-[20px] bg-lingua-deep-purple px-5 py-5"
        style={styles.reviewCardShadow}
      >
        <Text className="text-[12px] leading-[17px] font-poppins-semibold uppercase tracking-[1px] text-[#C4B5FF]">
          Personalized review
        </Text>
        <Text className="mt-1 text-[20px] leading-[26px] font-poppins-bold text-white">
          {due.length > 0
            ? `${due.length} ${due.length === 1 ? "item" : "items"} to review`
            : "You're all caught up"}
        </Text>
        <Text className="mt-1 text-[13px] leading-[19px] font-poppins-regular text-[#D3C7FF]">
          {due.length > 0
            ? "Built from the words you've studied — misses come back sooner."
            : "Review again to keep your words in long-term memory."}
        </Text>
        <TouchableOpacity
          activeOpacity={0.86}
          accessibilityRole="button"
          className="mt-4 h-[46px] w-[168px] flex-row items-center justify-center rounded-[14px] bg-white"
          onPress={() => router.push("/practice" as Href)}
        >
          <Ionicons color="#5B3BF6" name="flash" size={17} />
          <Text className="ml-2 text-[14px] font-poppins-semibold text-lingua-deep-purple">
            {due.length > 0 ? "Start review" : "Practice anyway"}
          </Text>
        </TouchableOpacity>
      </View>

      {weak.length > 0 ? (
        <View className="mt-6">
          <Text className="mb-[12px] text-[13px] leading-[18px] font-poppins-semibold uppercase tracking-widest text-[#8E97B0]">
            Your weak spots
          </Text>
          {weak.slice(0, 6).map((target) => (
            <WeakSpotRow key={target.id} target={target} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function WeakSpotRow({ target }: { target: ReviewTarget }) {
  return (
    <View className="mb-[10px] flex-row items-center rounded-[15px] border border-[#F3E6E6] bg-[#FFF8F8] px-4 py-3">
      <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-[#FDECEC]">
        <Ionicons color="#E0705A" name="alert-circle" size={18} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-[15px] leading-[20px] font-poppins-semibold text-text-primary">
          {target.term}
        </Text>
        <Text className="text-[12px] leading-[17px] font-poppins-regular text-[#8B7B7B]">
          {target.translation}
        </Text>
      </View>
    </View>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function getLessonStatus(
  lessonId: string,
  index: number,
  activeLessonIndex: number,
  completedLessonIds: string[],
): LessonStatus {
  if (completedLessonIds.includes(lessonId)) return "completed";
  if (index === activeLessonIndex) return "inProgress";
  return "notStarted";
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: PURPLE,
    elevation: 3,
    shadowColor: "#321d93",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  connector: {
    backgroundColor: "#E7E9F2",
    borderRadius: 3,
    height: 22,
    marginVertical: 2,
    width: 6,
  },
  mascotImage: {
    height: 110,
    width: 110,
  },
  nodeBase: {
    // No `left` here on purpose — the parent's alignItems:"center" centers this
    // absolutely-positioned layer horizontally, same as nodeFace. A hardcoded
    // left:0 previously pinned it to the wrap's left edge instead, making the
    // "3D depth" base peek out diagonally to the upper-left instead of cleanly
    // from underneath.
    borderRadius: 40,
    height: 74,
    position: "absolute",
    top: 8,
    width: 74,
  },
  nodeFace: {
    alignItems: "center",
    borderRadius: 40,
    height: 74,
    justifyContent: "center",
    overflow: "hidden",
    width: 74,
  },
  nodeGloss: {
    backgroundColor: "rgba(255,255,255,0.30)",
    borderRadius: 20,
    height: 16,
    position: "absolute",
    top: 11,
    width: 38,
  },
  nodeRing: {
    borderColor: "rgba(91,59,246,0.22)",
    borderRadius: 47,
    borderWidth: 5,
    height: 94,
    position: "absolute",
    top: -3,
    width: 94,
  },
  nodeWrap: {
    alignItems: "center",
    height: 82,
    justifyContent: "flex-start",
    width: 94,
  },
  reviewCardShadow: {
    elevation: 8,
    shadowColor: "#321d93",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  scrollContent: {
    alignSelf: "center",
    paddingBottom: 140,
    paddingTop: 0,
  },
  segmentedCard: {
    height: 52,
  },
  segmentedShadow: {
    elevation: 6,
    shadowColor: "#1B2340",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 3,
    borderColor: "#E3E3EA",
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  startCard: {
    backgroundColor: PURPLE,
    borderRadius: 18,
    elevation: 6,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: "#321d93",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  startPointer: {
    backgroundColor: PURPLE,
    height: 16,
    left: "50%",
    marginLeft: -8,
    position: "absolute",
    top: -7,
    transform: [{ rotate: "45deg" }],
    width: 16,
  },
});
