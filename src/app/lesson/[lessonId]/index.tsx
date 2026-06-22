import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getLessonImageSource } from "@/constants/images";
import { lessonsById } from "@/data/lessons";
import { units } from "@/data/units";

export default function LessonDetailScreen() {
  const params = useLocalSearchParams<{ lessonId?: string | string[] }>();
  const lessonId = Array.isArray(params.lessonId)
    ? params.lessonId[0]
    : params.lessonId;
  const lesson = lessonId ? lessonsById[lessonId] : null;
  const unit = lesson ? units.find((item) => item.id === lesson.unitId) : null;

  if (!lesson) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[22px] leading-[29px] font-poppins-semibold text-text-primary">
            Lesson not found
          </Text>
          <TouchableOpacity
            activeOpacity={0.82}
            className="mt-5 h-[48px] items-center justify-center rounded-[16px] bg-lingua-deep-purple px-6"
            onPress={() => router.back()}
          >
            <Text className="text-[15px] leading-[21px] font-poppins-semibold text-white">
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View className="h-[52px] flex-row items-center">
          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            className="h-[44px] w-[44px] items-start justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-[42px] leading-[42px] font-poppins-regular text-text-primary">
              {"‹"}
            </Text>
          </TouchableOpacity>

          <Text
            className="ml-2 flex-1 text-[19px] leading-[25px] font-poppins-semibold text-text-primary"
            numberOfLines={1}
          >
            {lesson.title}
          </Text>
        </View>

        <View
          className="mt-3 h-[214px] items-center justify-center overflow-hidden rounded-[24px] bg-[#F4F1FF]"
          style={styles.heroCard}
        >
          <Image
            className="h-[174px] w-[220px]"
            resizeMode="contain"
            source={getLessonImageSource(lesson.imageKey)}
          />
        </View>

        <Text className="mt-6 text-[27px] leading-[34px] font-poppins-bold text-text-primary">
          {lesson.title}
        </Text>
        <Text className="mt-2 text-[15px] leading-[23px] font-poppins-regular text-[#6F7896]">
          {lesson.description}
        </Text>

        <View className="mt-5 flex-row">
          <MetaPill icon="sparkles" label={`${lesson.xpReward} XP`} />
          <MetaPill icon="time-outline" label={`${lesson.estimatedMinutes} min`} />
          <MetaPill
            icon="layers-outline"
            label={`Unit ${(unit?.order ?? 2) + 1}`}
          />
        </View>

        <Section title="Goals">
          {lesson.goals.map((goal) => (
            <View
              className="mb-3 rounded-[18px] border border-[#EEF1F7] bg-white px-4 py-4"
              key={goal.id}
            >
              <Text className="text-[15px] leading-[21px] font-poppins-semibold text-text-primary">
                {goal.title}
              </Text>
              <Text className="mt-1 text-[13px] leading-[20px] font-poppins-regular text-[#727B96]">
                {goal.description}
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Vocabulary">
          {lesson.vocabulary.map((item) => (
            <View
              className="mb-3 flex-row items-center rounded-[18px] border border-[#EEF1F7] bg-white px-4 py-4"
              key={item.id}
            >
              <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-[#F1EDFF]">
                <Text className="text-[17px] leading-[22px] font-poppins-semibold text-lingua-deep-purple">
                  {item.term.charAt(0)}
                </Text>
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-[15px] leading-[21px] font-poppins-semibold text-text-primary">
                  {item.term}
                </Text>
                <Text className="mt-0.5 text-[13px] leading-[19px] font-poppins-regular text-[#727B96]">
                  {item.translation} {"•"} {item.pronunciation}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="Key phrase">
          <View className="rounded-[20px] bg-[#F8F6FF] px-5 py-5">
            <Text className="text-[18px] leading-[25px] font-poppins-semibold text-text-primary">
              {lesson.phrases[0]?.text}
            </Text>
            <Text className="mt-2 text-[14px] leading-[21px] font-poppins-regular text-[#6F7896]">
              {lesson.phrases[0]?.translation}
            </Text>
          </View>
        </Section>

        <TouchableOpacity
          activeOpacity={0.84}
          className="mt-6 h-[58px] flex-row items-center justify-center rounded-[20px] bg-lingua-deep-purple"
          onPress={() => router.push(`/lesson/${lessonId}/audio` as Href)}
          style={styles.startButton}
        >
          <Ionicons color="#FFFFFF" name="headset" size={20} />
          <Text className="ml-2 text-[17px] leading-[23px] font-poppins-semibold text-white">
            Start audio lesson
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

type MetaPillProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

function MetaPill({ icon, label }: MetaPillProps) {
  return (
    <View className="mr-2 flex-row items-center rounded-full bg-[#F4F6FB] px-3 py-2">
      <Ionicons color="#5B3BF6" name={icon} size={15} />
      <Text className="ml-1.5 text-[12px] leading-[17px] font-poppins-semibold text-[#5E6785]">
        {label}
      </Text>
    </View>
  );
}

type SectionProps = {
  children: React.ReactNode;
  title: string;
};

function Section({ children, title }: SectionProps) {
  return (
    <View className="mt-6">
      <Text className="mb-3 text-[18px] leading-[24px] font-poppins-semibold text-text-primary">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    elevation: 4,
    shadowColor: "#321D93",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 34,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  startButton: {
    elevation: 6,
    shadowColor: "#321D93",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
});
