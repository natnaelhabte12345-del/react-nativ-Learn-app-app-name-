import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useUser } from "@clerk/expo";
import {
  Image,
  type ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect } from "react";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { images } from "@/constants/images";
import { defaultLanguageId, languages } from "@/data/languages";
import { lessons } from "@/data/lessons";
import { units } from "@/data/units";
import { useLanguageStore } from "@/store/language-store";
import { useProgressStore } from "@/store/progress-store";
import type { LanguageId, Lesson } from "@/types/learning";

const DAILY_GOAL_XP = 20;
const CONTENT_MAX_WIDTH = 420;

const flagImages: Record<LanguageId, ImageSourcePropType> = {
  chinese: images.flagChinese,
  french: images.flagFrench,
  german: images.flagGerman,
  japanese: images.flagJapanese,
  korean: images.flagKorean,
  spanish: images.flagSpanish,
};

const greetings: Record<LanguageId, string> = {
  chinese: "Ni hao",
  french: "Bonjour",
  german: "Hallo",
  japanese: "Konnichiwa",
  korean: "Annyeong",
  spanish: "Hola",
};

export function HomeScreen() {
  const { isLoaded, user } = useUser();
  const { width } = useWindowDimensions();
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const streak = useProgressStore((state) => state.streak);
  const dailyXp = useProgressStore((state) => state.dailyXp);
  const recordActivity = useProgressStore((state) => state.recordActivity);

  // Record that the user opened the app today — updates streak if it's a new day
  useEffect(() => {
    recordActivity();
  }, [recordActivity]);

  if (!isLoaded || !hasHydrated) {
    return <AppLoadingScreen message="Loading your dashboard..." />;
  }

  const selectedLanguage =
    languages.find((language) => language.id === selectedLanguageId) ??
    languages.find((language) => language.id === defaultLanguageId) ??
    languages[0];
  const languageLessons = lessons.filter(
    (lesson) => lesson.languageId === selectedLanguage.id,
  );
  const visibleLessons =
    languageLessons.length > 0
      ? languageLessons
      : lessons.filter((lesson) => lesson.languageId === defaultLanguageId);
  const currentLesson: Lesson | null =
    visibleLessons[1] ?? visibleLessons[0] ?? null;
  const currentUnit =
    (currentLesson
      ? units.find((unit) => unit.id === currentLesson.unitId)
      : null) ??
    units.find((unit) => unit.languageId === selectedLanguage.id) ??
    null;
  const earnedXp = Math.min(dailyXp, DAILY_GOAL_XP);
  const progress = DAILY_GOAL_XP > 0 ? earnedXp / DAILY_GOAL_XP : 0;
  const displayName =
    user?.firstName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress.split("@")[0] ??
    "Alex";
  const contentWidth = Math.min(Math.max(width - 30, 0), CONTENT_MAX_WIDTH);
  const unitLabel = `A1 \u00B7 Unit ${Math.max((currentUnit?.order ?? 2) + 1, 3)}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={[
          styles.scrollContent,
          { width: contentWidth },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View className="h-[48px] flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="h-[36px] w-[36px] overflow-hidden rounded-full bg-white">
              <Image
                className="h-full w-full"
                resizeMode="cover"
                source={flagImages[selectedLanguage.id]}
              />
            </View>
            <Text
              className="ml-3 text-[16px] leading-[22px] font-poppins-semibold text-text-primary"
              numberOfLines={1}
            >
              {greetings[selectedLanguage.id]}, {displayName}! {"\u{1F44B}"}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Text className="text-[25px] leading-[29px]">{"\u{1F525}"}</Text>
            <Text className="ml-2 text-[17px] leading-[23px] font-poppins-semibold text-[#39415f]">
              {streak}
            </Text>
            <View className="ml-5 h-[34px] w-[30px] items-center justify-center">
              <Ionicons color="#111936" name="notifications-outline" size={25} />
            </View>
          </View>
        </View>

        <DailyGoalCard earnedXp={earnedXp} progress={progress} />

        <ContinueLearningCard
          languageName={selectedLanguage.name}
          unitLabel={unitLabel}
        />

        <View className="mt-[12px] flex-row items-center justify-between">
          <Text className="text-[19px] leading-[25px] font-poppins-semibold text-text-primary">
            {"Today's plan"}
          </Text>
          <TouchableOpacity activeOpacity={0.75}>
            <Text className="text-[19px] leading-[25px] font-poppins-semibold text-lingua-deep-purple">
              View all
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-2">
          <PlanItem
            iconType="book"
            title="Lesson"
            subtitle={getLessonPlanSubtitle(currentLesson)}
          />
          <PlanItem
            iconType="headphones"
            title="AI Conversation"
            subtitle="Talk about your day"
          />
          <PlanItem
            iconType="chat"
            title="New words"
            subtitle="10 words"
          />
        </View>

        <NextUpCard />
      </ScrollView>
    </SafeAreaView>
  );
}

type DailyGoalCardProps = {
  earnedXp: number;
  progress: number;
};

function DailyGoalCard({ earnedXp, progress }: DailyGoalCardProps) {
  return (
    <View
      className="mt-[12px] h-[100px] flex-row items-center justify-between overflow-hidden rounded-[18px] bg-[#fff7ee] px-5"
      style={styles.softCardShadow}
    >
      <View className="flex-1">
        <Text className="text-[15px] leading-[20px] font-poppins-semibold text-[#303954]">
          Daily goal
        </Text>
        <View className="mt-1 flex-row items-end">
          <Text className="text-[30px] leading-[36px] font-poppins-semibold text-[#101936]">
            {earnedXp}
          </Text>
          <Text className="mb-1 ml-2 text-[16px] leading-[22px] font-poppins-semibold text-[#79819c]">
            / {DAILY_GOAL_XP} XP
          </Text>
        </View>
        <View className="mt-3 h-[9px] max-w-[260px] overflow-hidden rounded-full bg-[#ffe2bd]">
          <View
            className="h-full rounded-full bg-[#ff7a00]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
      </View>

      <Image
        className="h-[76px] w-[100px]"
        resizeMode="contain"
        source={images.treasure}
      />
    </View>
  );
}

type ContinueLearningCardProps = {
  languageName: string;
  unitLabel: string;
};

function ContinueLearningCard({
  languageName,
  unitLabel,
}: ContinueLearningCardProps) {
  return (
    <View
      className="relative mt-[12px] h-[202px] overflow-hidden rounded-[22px] bg-lingua-deep-purple px-5 pt-[18px]"
      style={styles.continueCardShadow}
    >
      {/* Jagged mountain range silhouette behind the cathedral */}
      <View style={styles.mountainLeft} />
      <View style={styles.mountainBack} />
      <View style={styles.mountainFront} />
      {/* Green hill under the cathedral */}
      <View
        className="absolute bg-[#50b82d]"
        style={{ bottom: -56, right: -24, width: 196, height: 120, borderRadius: 98 }}
      />
      <Image
        className="absolute bottom-[-10px] right-[-4px] h-[140px] w-[160px]"
        resizeMode="contain"
        source={images.palace}
      />

      <Text className="text-[16px] leading-[21px] font-poppins-semibold text-white">
        Continue learning
      </Text>
      <Text className="mt-2 text-[26px] leading-[31px] font-poppins-bold text-white">
        {languageName}
      </Text>
      <Text className="mt-1 text-[16px] leading-[22px] font-poppins-medium text-white">
        {unitLabel}
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        className="mt-5 h-[42px] w-[106px] items-center justify-center rounded-[14px] bg-white"
        style={styles.continueButtonShadow}
      >
        <Text className="text-[16px] leading-[22px] font-poppins-semibold text-lingua-deep-purple">
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}

type PlanItemProps = {
  completed?: boolean;
  iconType: "book" | "chat" | "headphones";
  subtitle: string;
  title: string;
};

function PlanItem({
  completed = false,
  iconType,
  subtitle,
  title,
}: PlanItemProps) {
  const isChat = iconType === "chat";

  return (
    <View className="h-[54px] flex-row items-center">
      <View
        className={
          isChat
            ? "h-[46px] w-[46px] items-center justify-center rounded-[11px] bg-[#ff4d4f]"
            : "h-[46px] w-[46px] items-center justify-center rounded-[11px] bg-lingua-deep-purple"
        }
        style={styles.planIconShadow}
      >
        <PlanIcon type={iconType} />
      </View>

      <View className="ml-4 flex-1">
        <Text className="text-[16px] leading-[21px] font-poppins-semibold text-text-primary">
          {title}
        </Text>
        <Text
          className="mt-[2px] text-[13px] leading-[18px] font-poppins-regular text-[#7c849e]"
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>

      <View
        className={
          completed
            ? "h-[26px] w-[26px] items-center justify-center rounded-full bg-lingua-deep-purple"
            : "h-[26px] w-[26px] rounded-full border-[2px] border-[#8990a9]"
        }
      >
        {completed ? (
          <Text className="text-[15px] leading-[18px] font-poppins-semibold text-white">
            {"\u2713"}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function NextUpCard() {
  return (
    <View
      className="relative mt-[10px] h-[100px] overflow-hidden rounded-[18px] bg-[#f4fced] px-5"
      style={styles.softCardShadow}
    >
      <View className="h-full justify-center">
        <Text className="text-[15px] leading-[20px] font-poppins-medium text-[#737b96]">
          Next up
        </Text>
        <Text className="mt-1 text-[19px] leading-[25px] font-poppins-semibold text-text-primary">
          AI Video Call
        </Text>
        <Text className="mt-[2px] text-[13px] leading-[18px] font-poppins-regular text-[#65708d]">
          Practice speaking
        </Text>
      </View>

      {/* Soft halo behind the portrait */}
      <View
        className="absolute rounded-full bg-[#e6f4d8]"
        style={{ right: 72, top: 10, width: 80, height: 80 }}
      />
      <Image
        className="absolute rounded-full"
        resizeMode="cover"
        source={images.teacherPortrait}
        style={{ right: 76, top: 13, width: 74, height: 74 }}
      />

      <TouchableOpacity
        activeOpacity={0.82}
        className="absolute items-center justify-center rounded-full bg-[#55c71e]"
        style={{ right: 16, top: 25, width: 50, height: 50 }}
      >
        <Ionicons color="#FFFFFF" name="videocam" size={24} />
      </TouchableOpacity>
    </View>
  );
}

function getLessonPlanSubtitle(lesson: Lesson | null) {
  if (!lesson) {
    return "No lesson available";
  }

  const unitTitle = units.find((unit) => unit.id === lesson.unitId)?.title;

  if (unitTitle?.toLowerCase().includes("cafe")) {
    return "At the caf\u00E9";
  }

  return lesson.title;
}

function PlanIcon({ type }: { type: "book" | "chat" | "headphones" }) {
  if (type === "book") {
    return <Ionicons color="#FFFFFF" name="book" size={23} />;
  }

  if (type === "headphones") {
    return <MaterialCommunityIcons color="#FFFFFF" name="headphones" size={25} />;
  }

  return <Ionicons color="#FFFFFF" name="chatbubble" size={21} />;
}

const styles = StyleSheet.create({
  continueButtonShadow: {
    elevation: 6,
    shadowColor: "#261072",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  continueCardShadow: {
    elevation: 8,
    shadowColor: "#321d93",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  mountainBack: {
    borderBottomColor: "#7b61ef",
    borderBottomWidth: 82,
    borderLeftColor: "transparent",
    borderLeftWidth: 66,
    borderRightColor: "transparent",
    borderRightWidth: 66,
    bottom: 0,
    height: 0,
    opacity: 0.55,
    position: "absolute",
    right: 92,
    width: 0,
  },
  mountainFront: {
    borderBottomColor: "#9079f7",
    borderBottomWidth: 58,
    borderLeftColor: "transparent",
    borderLeftWidth: 52,
    borderRightColor: "transparent",
    borderRightWidth: 52,
    bottom: 0,
    height: 0,
    opacity: 0.5,
    position: "absolute",
    right: 44,
    width: 0,
  },
  mountainLeft: {
    borderBottomColor: "#6a4fe6",
    borderBottomWidth: 50,
    borderLeftColor: "transparent",
    borderLeftWidth: 44,
    borderRightColor: "transparent",
    borderRightWidth: 44,
    bottom: 0,
    height: 0,
    opacity: 0.5,
    position: "absolute",
    right: 162,
    width: 0,
  },
  planIconShadow: {
    elevation: 5,
    shadowColor: "#3b22aa",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  scrollContent: {
    alignSelf: "center",
    paddingBottom: 116,
    paddingTop: 4,
  },
  softCardShadow: {
    elevation: 3,
    shadowColor: "#0D132B",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
});
