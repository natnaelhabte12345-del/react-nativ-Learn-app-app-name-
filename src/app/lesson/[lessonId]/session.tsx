import { router, useLocalSearchParams, type Href } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LessonPlayer } from "@/components/lessons/lesson-player";
import { lessonsById } from "@/data/lessons";

export default function LessonSessionScreen() {
  const params = useLocalSearchParams<{ lessonId?: string | string[] }>();
  const lessonId = Array.isArray(params.lessonId)
    ? params.lessonId[0]
    : params.lessonId;
  const lesson = lessonId ? lessonsById[lessonId] : null;

  if (!lesson) {
    return (
      <SafeAreaView style={{ backgroundColor: "#FFFFFF", flex: 1 }}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[18px] font-poppins-semibold text-text-primary">
            Lesson not found
          </Text>
          <TouchableOpacity
            activeOpacity={0.82}
            className="mt-4 h-[44px] items-center justify-center rounded-[14px] bg-lingua-deep-purple px-6"
            onPress={() => router.back()}
          >
            <Text className="text-[14px] font-poppins-semibold text-white">Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LessonPlayer
      lesson={lesson}
      onExit={() => router.back()}
      onSpeak={() => router.replace(`/lesson/${lesson.id}/audio` as Href)}
    />
  );
}
