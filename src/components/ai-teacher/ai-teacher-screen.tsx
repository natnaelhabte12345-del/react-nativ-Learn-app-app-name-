import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { getLessonImageSource, images } from "@/constants/images";
import { defaultLanguageId } from "@/data/languages";
import { defaultTrackId } from "@/data/tracks";
import { getTrackLessons } from "@/lib/tracks";
import { useLanguageStore } from "@/store/language-store";
import { useProgressStore } from "@/store/progress-store";
import type { Lesson } from "@/types/learning";

export function AiTeacherScreen() {
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const trackId = useLanguageStore((state) => state.trackId) ?? defaultTrackId;
  const completedLessonIds = useProgressStore((state) => state.completedLessonIds);

  if (!hasHydrated) return <AppLoadingScreen message="Loading..." />;

  // Same track-scoped list and progress gating as the Learn path, so a topic
  // only becomes available here once the learner has actually reached it there.
  const scoped = getTrackLessons(selectedLanguageId, trackId);
  const trackLessons = scoped.length > 0 ? scoped : getTrackLessons(selectedLanguageId, "a1");

  const nextLessonIndex = trackLessons.findIndex(
    (l) => !completedLessonIds.includes(l.id),
  );
  const nextLesson = nextLessonIndex >= 0 ? trackLessons[nextLessonIndex] : null;
  // A topic is reachable once it's completed or it's the very next one up.
  const reachableCount = nextLessonIndex === -1 ? trackLessons.length : nextLessonIndex + 1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View className="h-[52px] flex-row items-center justify-between">
          <Text className="text-[22px] leading-[28px] font-poppins-bold text-text-primary">
            AI Conversation
          </Text>
          <Image
            className="h-[40px] w-[40px]"
            resizeMode="contain"
            source={images.mascotLogo}
          />
        </View>

        <View className="mt-3 flex-row items-center rounded-[18px] bg-[#F4F0FF] px-5 py-4">
          <Ionicons color="#5B3BF6" name="mic" size={22} />
          <Text className="ml-3 flex-1 text-[14px] leading-[21px] font-poppins-regular text-[#5B3BF6]">
            Learned the words in Lessons? This is where you actually speak them. Have a real voice conversation with Duo — no tapping, just talking.
          </Text>
        </View>

        {nextLesson ? (
          <View className="mt-6">
            <Text className="mb-3 text-[17px] leading-[23px] font-poppins-semibold text-text-primary">
              Continue where you left off
            </Text>
            <NextLessonCard lesson={nextLesson} />
          </View>
        ) : null}

        <View className="mt-6">
          <Text className="mb-3 text-[17px] leading-[23px] font-poppins-semibold text-text-primary">
            All topics
          </Text>
          {/* Only topics the learner has reached (completed + the current one)
              are listed — topics further out aren't shown at all, matching the
              Learn path (no spoiling what's still locked). */}
          {trackLessons.slice(0, reachableCount).map((lesson) => (
            <TopicCard
              isCompleted={completedLessonIds.includes(lesson.id)}
              key={lesson.id}
              lesson={lesson}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NextLessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      className="overflow-hidden rounded-[20px] bg-lingua-deep-purple px-5 py-5"
      onPress={() => router.push(`/lesson/${lesson.id}/audio` as Href)}
      style={styles.nextLessonShadow}
    >
      <Text className="text-[12px] leading-[17px] font-poppins-semibold uppercase tracking-[1px] text-[#C4B5FF]">
        Next up
      </Text>
      <Text className="mt-1 text-[18px] leading-[24px] font-poppins-bold text-white">
        {lesson.title}
      </Text>
      <Text className="mt-1 text-[13px] leading-[19px] font-poppins-regular text-[#C4B5FF]">
        {lesson.vocabulary.map((v) => v.term).join(" · ")}
      </Text>
      <View className="mt-4 h-[42px] w-[152px] flex-row items-center justify-center rounded-[14px] bg-white">
        <Ionicons color="#5B3BF6" name="headset" size={17} />
        <Text className="ml-2 text-[14px] font-poppins-semibold text-lingua-deep-purple">
          Start lesson
        </Text>
      </View>
    </TouchableOpacity>
  );
}

type TopicCardProps = {
  isCompleted: boolean;
  lesson: Lesson;
};

function TopicCard({ isCompleted, lesson }: TopicCardProps) {
  return (
    <TouchableOpacity
      accessibilityLabel={lesson.title}
      activeOpacity={0.82}
      className="mb-3 flex-row items-center rounded-[16px] border border-[#EEF1F7] bg-white px-4 py-4"
      onPress={() => router.push(`/lesson/${lesson.id}/audio` as Href)}
      style={styles.topicCardShadow}
    >
      <Image
        className="h-[52px] w-[52px]"
        resizeMode="contain"
        source={getLessonImageSource(lesson.imageKey)}
      />
      <View className="ml-4 flex-1">
        <Text className="text-[15px] leading-[21px] font-poppins-semibold text-text-primary">
          {lesson.title}
        </Text>
        <Text
          className="mt-1 text-[12px] leading-[17px] font-poppins-regular text-[#727B96]"
          numberOfLines={1}
        >
          {lesson.vocabulary.map((v) => v.term).join(" · ")}
        </Text>
      </View>
      {isCompleted ? (
        <View className="ml-2 h-[26px] w-[26px] items-center justify-center rounded-full bg-[#25C636]">
          <Text className="text-[15px] font-poppins-bold text-white">{"✓"}</Text>
        </View>
      ) : (
        <Ionicons color="#9AA1B3" name="chevron-forward" size={18} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  nextLessonShadow: {
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
    paddingBottom: 118,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topicCardShadow: {
    elevation: 2,
    shadowColor: "#0D132B",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
});
