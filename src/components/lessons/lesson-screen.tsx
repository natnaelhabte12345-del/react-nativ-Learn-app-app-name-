import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { getLessonImageSource, images } from "@/constants/images";
import { defaultLanguageId } from "@/data/languages";
import { lessonsById, lessonsByLanguageId } from "@/data/lessons";
import { unitsByLanguageId } from "@/data/units";
import {
  getDueReviewTargets,
  getWeakReviewTargets,
  type ReviewTarget,
} from "@/lib/learning-review";
import { useLanguageStore } from "@/store/language-store";
import { useProgressStore } from "@/store/progress-store";
import type { LanguageId, LearningUnit, Lesson } from "@/types/learning";

const CONTENT_MAX_WIDTH = 500;
const CONTENT_PADDING = 18;
// Ratio of the header-less café illustration (assets/images/lesson-cafe-scene.png).
const SCENE_ASPECT_RATIO = 546 / 272;
// How far the floating tab card overlaps the bottom edge of the illustration.
const SEGMENT_OVERLAP = 26;
type LessonStatus = "completed" | "inProgress" | "notStarted";
type LessonTab = "lessons" | "practice";

export function LessonScreen() {
  const { width } = useWindowDimensions();
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const completedLessonIds = useProgressStore((state) => state.completedLessonIds);
  const [activeTab, setActiveTab] = useState<LessonTab>("lessons");

  const lessonPath = useMemo(
    () => getLessonPath(selectedLanguageId),
    [selectedLanguageId],
  );

  if (!hasHydrated) {
    return <AppLoadingScreen message="Loading lessons..." />;
  }

  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);
  // The card row sits inside the horizontal padding; the hero spans full width.
  const innerWidth = contentWidth - CONTENT_PADDING * 2;

  if (lessonPath.lessons.length === 0) {
    return <AppLoadingScreen message="No lessons available yet." />;
  }

  const unit = lessonPath.unit;
  const totalLessons = lessonPath.lessons.length;
  const activeLessonIndex = lessonPath.lessons.findIndex(
    (lesson) => !completedLessonIds.includes(lesson.id),
  );
  const currentLesson =
    activeLessonIndex === -1 ? totalLessons : activeLessonIndex + 1;
  const heroTitle = unit?.title ?? "At the Café";
  const heroSubtitle = `Unit ${(unit?.order ?? 2) + 1} • ${currentLesson} / ${totalLessons} lessons`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={[styles.scrollContent, { width: contentWidth }]}
        showsVerticalScrollIndicator={false}
      >
        <LessonHero
          contentWidth={contentWidth}
          subtitle={heroSubtitle}
          title={heroTitle}
        />

        {/* Floating segmented control overlapping the hero's bottom edge. */}
        <View className="z-20 px-[18px]" style={{ marginTop: -SEGMENT_OVERLAP }}>
          <LessonTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            width={innerWidth}
          />
        </View>

        <View className="px-[18px]">
          {activeTab === "lessons" ? (
            <View className="mt-[20px]">
              {lessonPath.lessons.map((lesson, index) => (
                <LessonCard
                  index={index}
                  key={lesson.id}
                  lesson={lesson}
                  status={getLessonStatus(lesson.id, index, activeLessonIndex, completedLessonIds)}
                />
              ))}
            </View>
          ) : (
            <PracticeContent completedLessonIds={completedLessonIds} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type LessonHeroProps = {
  contentWidth: number;
  subtitle: string;
  title: string;
};

function LessonHero({ contentWidth, subtitle, title }: LessonHeroProps) {
  return (
    <View>
      {/* Real header text stays crisp and reflects the selected language/unit. */}
      <View className="flex-row items-center px-[18px] pt-[4px]">
        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          className="-ml-[4px] h-[40px] w-[40px] items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons color="#1B2340" name="chevron-back" size={28} />
        </TouchableOpacity>

        <Text
          className="flex-1 text-center text-[26px] leading-[34px] font-poppins-bold text-text-primary"
          numberOfLines={1}
        >
          {title}
        </Text>

        <View className="w-[40px] items-end justify-center">
          <Ionicons color="#EBB733" name="bookmark" size={26} />
        </View>
      </View>

      <Text className="mt-[2px] text-center text-[15px] leading-[21px] font-poppins-medium text-[#8E97B0]">
        {subtitle}
      </Text>

      <Image
        className="mt-[14px]"
        resizeMode="cover"
        source={images.lessonCafeScene}
        style={{ width: contentWidth, aspectRatio: SCENE_ASPECT_RATIO }}
      />
    </View>
  );
}

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

  // A short bar centered under the active tab's label (not the full half-width).
  const indicatorWidth = Math.max(64, Math.round(tabWidth * 0.58));
  const baseOffset = (tabWidth - indicatorWidth) / 2;
  const translateX = indicator.interpolate({
    inputRange: [0, 1],
    outputRange: [baseOffset, tabWidth + baseOffset],
  });

  return (
    <View
      className="flex-row overflow-hidden rounded-[23px] bg-white"
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
        className={`text-[17px] leading-[23px] ${
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
    <View
      className="mb-[10px] flex-row items-center rounded-[15px] border border-[#F3E6E6] bg-[#FFF8F8] px-4 py-3"
    >
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

type LessonCardProps = {
  index: number;
  lesson: Lesson;
  status: LessonStatus;
};

function LessonCard({ index, lesson, status }: LessonCardProps) {
  const isInProgress = status === "inProgress";
  const cardMinHeight = isInProgress ? 98 : 80;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      accessibilityRole="button"
      className={`mb-[8px] justify-center rounded-[17px] border bg-white px-[22px] py-[13px] ${
        isInProgress
          ? "border-[#9278FF] bg-[#FCFBFF]"
          : "border-[#EEF1F7]"
      }`}
      onPress={() => router.push(`/lesson/${lesson.id}` as Href)}
      style={[
        isInProgress ? styles.activeLessonCard : styles.lessonCard,
        { minHeight: cardMinHeight },
      ]}
      testID={`lesson-card-${lesson.id}`}
    >
      <View className="max-w-[78%]">
        <Text
          className={`text-[13px] leading-[18px] font-poppins-semibold ${
            isInProgress ? "text-lingua-deep-purple" : "text-[#8790AA]"
          }`}
        >
          Lesson {index + 1}
        </Text>
        <Text
          className="mt-[6px] text-[16px] leading-[22px] font-poppins-semibold text-text-primary"
          numberOfLines={1}
        >
          {lesson.title}
        </Text>
        <Text
          className="mt-[3px] text-[12px] leading-[17px] font-poppins-regular text-[#727B96]"
          numberOfLines={1}
        >
          {lesson.vocabulary.map((item) => item.term).join(" · ")}
        </Text>
        <LessonStatusText status={status} />
      </View>

      <View className="absolute right-[25px] top-0 bottom-0 items-center justify-center">
        <LessonStatusMark lesson={lesson} status={status} />
      </View>
    </TouchableOpacity>
  );
}

type LessonStatusTextProps = {
  status: LessonStatus;
};

function LessonStatusText({ status }: LessonStatusTextProps) {
  if (status !== "inProgress") {
    return null;
  }

  return (
    <Text className="mt-[3px] text-[14px] leading-[19px] font-poppins-semibold text-lingua-deep-purple">
      In progress
    </Text>
  );
}

type LessonStatusMarkProps = {
  lesson: Lesson;
  status: LessonStatus;
};

function LessonStatusMark({ lesson, status }: LessonStatusMarkProps) {
  const imageSource = getLessonImageSource(lesson.imageKey);

  if (status === "completed") {
    return (
      <View
        className="h-[31px] w-[31px] items-center justify-center rounded-full bg-[#25C636]"
        style={styles.completedMark}
      >
        <Text className="text-[20px] leading-[23px] font-poppins-bold text-white">
          {"\u2713"}
        </Text>
      </View>
    );
  }

  if (status === "inProgress") {
    return (
      <Image
        className="h-[58px] w-[58px]"
        resizeMode="contain"
        source={imageSource}
      />
    );
  }

  // No locking for now: lessons that have not been started show no status mark,
  // and every card remains tappable.
  return null;
}

function getLessonStatus(
  lessonId: string,
  index: number,
  activeLessonIndex: number,
  completedLessonIds: string[],
): LessonStatus {
  if (completedLessonIds.includes(lessonId)) return "completed";
  if (activeLessonIndex !== -1 && index === activeLessonIndex) return "inProgress";
  return "notStarted";
}

function getLessonPath(languageId: LanguageId) {
  const languageUnits =
    unitsByLanguageId[languageId] ?? unitsByLanguageId[defaultLanguageId] ?? [];
  const unit =
    [...languageUnits].sort(
      (left, right) =>
        right.lessonIds.length - left.lessonIds.length || left.order - right.order,
    )[0] ?? null;
  const unitLessons = getLessonsForUnit(unit, languageId);

  if (unitLessons.length > 0) {
    return {
      languageId,
      lessons: unitLessons,
      unit,
    };
  }

  const fallbackLessons = lessonsByLanguageId[defaultLanguageId] ?? [];
  const fallbackUnit = (unitsByLanguageId[defaultLanguageId] ?? [])[0] ?? null;

  return {
    languageId: defaultLanguageId,
    lessons: fallbackLessons,
    unit: fallbackUnit,
  };
}

function getLessonsForUnit(unit: LearningUnit | null, languageId: LanguageId) {
  const unitLessons =
    unit?.lessonIds
      .map((lessonId) => lessonsById[lessonId])
      .filter((lesson): lesson is Lesson => Boolean(lesson)) ?? [];

  if (unitLessons.length > 0) {
    return unitLessons;
  }

  return lessonsByLanguageId[languageId] ?? [];
}

const styles = StyleSheet.create({
  activeLessonCard: {
    elevation: 4,
    shadowColor: "#6E48F6",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  completedMark: {
    elevation: 3,
    shadowColor: "#0A7F1F",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  lessonCard: {
    elevation: 2,
    shadowColor: "#0D132B",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
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
    paddingBottom: 118,
    paddingTop: 0,
  },
  segmentedCard: {
    height: 74,
  },
  segmentedShadow: {
    elevation: 8,
    shadowColor: "#1B2340",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
});
