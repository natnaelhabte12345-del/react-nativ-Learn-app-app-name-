import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PracticeSession } from "@/components/practice/practice-session";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { defaultLanguageId } from "@/data/languages";
import { lessonsById } from "@/data/lessons";
import {
  getDueReviewTargets,
  getReviewTargetsForLesson,
  type ReviewTarget,
} from "@/lib/learning-review";
import { useLanguageStore } from "@/store/language-store";
import { useProgressStore } from "@/store/progress-store";

export default function PracticeRoute() {
  const params = useLocalSearchParams<{ lessonId?: string | string[] }>();
  const lessonId = Array.isArray(params.lessonId) ? params.lessonId[0] : params.lessonId;

  const hasHydrated = useProgressStore((state) => state.hasHydrated);
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const completedLessonIds = useProgressStore((state) => state.completedLessonIds);
  const reviewProgress = useProgressStore((state) => state.reviewProgress);

  const { languageId, targets, title } = useMemo(() => {
    // Post-lesson mode: lead with the chunks just taught, then fold in anything
    // due from earlier lessons so new material is reinforced alongside review.
    if (lessonId && lessonsById[lessonId]) {
      const lesson = lessonsById[lessonId];
      const due = getDueReviewTargets({
        completedLessonIds: completedLessonIds.filter((id) => id !== lessonId),
        languageId: lesson.languageId,
        reviewProgress,
      });
      return {
        languageId: lesson.languageId,
        title: "Practice what you learned",
        targets: [...getReviewTargetsForLesson(lesson), ...due] as ReviewTarget[],
      };
    }

    // General review mode: everything that's due across completed lessons,
    // falling back to all learned chunks when nothing is technically due yet.
    const due = getDueReviewTargets({
      completedLessonIds,
      languageId: selectedLanguageId,
      reviewProgress,
    });
    const fallback = completedLessonIds
      .map((id) => lessonsById[id])
      .filter((lesson) => lesson?.languageId === selectedLanguageId)
      .flatMap((lesson) => (lesson ? getReviewTargetsForLesson(lesson) : []));

    return {
      languageId: selectedLanguageId,
      title: "Daily review",
      targets: (due.length > 0 ? due : fallback) as ReviewTarget[],
    };
  }, [lessonId, completedLessonIds, reviewProgress, selectedLanguageId]);

  if (!hasHydrated) return <AppLoadingScreen message="Loading practice..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View className="flex-row items-center px-3 pb-1 pt-1">
        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons color="#1B2340" name="chevron-back" size={26} />
        </TouchableOpacity>
        <Text className="flex-1 text-[17px] leading-[23px] font-poppins-semibold text-text-primary">
          {title}
        </Text>
        <View className="w-10" />
      </View>

      <View className="flex-1 px-5 pb-4">
        <PracticeSession
          languageId={languageId}
          mode={lessonId ? "lesson" : "review"}
          onDone={() => router.back()}
          targets={targets}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
});
