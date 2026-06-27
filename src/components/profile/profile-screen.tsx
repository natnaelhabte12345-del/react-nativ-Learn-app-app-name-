import Ionicons from "@expo/vector-icons/Ionicons";
import { useClerk, useUser } from "@clerk/expo";
import { router } from "expo-router";
import {
  Image,
  type ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { defaultLanguageId, languages } from "@/data/languages";
import { useLanguageStore } from "@/store/language-store";
import { useProgressStore } from "@/store/progress-store";
import type { LanguageId } from "@/types/learning";

const flagImages: Record<LanguageId, ImageSourcePropType> = {
  chinese: images.flagChinese,
  french: images.flagFrench,
  german: images.flagGerman,
  japanese: images.flagJapanese,
  korean: images.flagKorean,
  spanish: images.flagSpanish,
};

export function ProfileScreen() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const streak = useProgressStore((state) => state.streak);
  const dailyXp = useProgressStore((state) => state.dailyXp);
  const completedLessonIds = useProgressStore((state) => state.completedLessonIds);

  const selectedLanguage =
    languages.find((l) => l.id === selectedLanguageId) ?? languages[0];
  const displayName =
    user?.firstName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress.split("@")[0] ??
    "Learner";

  async function handleSignOut() {
    await signOut();
    router.replace("/onboarding");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text className="h-[52px] text-[22px] leading-[52px] font-poppins-bold text-text-primary">
          Profile
        </Text>

        {/* Avatar + name */}
        <View className="mt-2 items-center">
          <View
            className="h-[80px] w-[80px] items-center justify-center rounded-full bg-[#F4F0FF]"
            style={styles.avatarShadow}
          >
            <Text className="text-[38px]">🦜</Text>
          </View>
          <Text className="mt-3 text-[20px] leading-[26px] font-poppins-semibold text-text-primary">
            {displayName}
          </Text>
          {user?.primaryEmailAddress ? (
            <Text className="mt-1 text-[13px] leading-[19px] font-poppins-regular text-[#727B96]">
              {user.primaryEmailAddress.emailAddress}
            </Text>
          ) : null}
        </View>

        {/* Stats row */}
        <View
          className="mt-6 flex-row rounded-[18px] border border-[#EEF1F7] bg-white px-2 py-4"
          style={styles.statCard}
        >
          <StatItem
            icon="flame"
            iconColor="#FF8A00"
            label="Streak"
            value={`${streak}d`}
          />
          <View className="w-px bg-[#EEF1F7]" />
          <StatItem
            icon="star"
            iconColor="#F59E0B"
            label="Today's XP"
            value={`${dailyXp} XP`}
          />
          <View className="w-px bg-[#EEF1F7]" />
          <StatItem
            icon="checkmark-circle"
            iconColor="#25C636"
            label="Lessons"
            value={`${completedLessonIds.length}`}
          />
        </View>

        {/* Current language */}
        <View className="mt-6">
          <Text className="mb-2 text-[13px] leading-[18px] font-poppins-semibold uppercase tracking-[1px] text-[#8B94A8]">
            Learning
          </Text>
          <TouchableOpacity
            activeOpacity={0.82}
            className="flex-row items-center rounded-[14px] border border-[#EEF1F7] bg-white px-4 py-4"
            onPress={() => router.push("/language-selection")}
            style={styles.rowShadow}
          >
            <View className="h-[36px] w-[36px] overflow-hidden rounded-full">
              <Image
                className="h-full w-full"
                resizeMode="cover"
                source={flagImages[selectedLanguage.id]}
              />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] leading-[21px] font-poppins-semibold text-text-primary">
                {selectedLanguage.name}
              </Text>
              <Text className="text-[12px] leading-[17px] font-poppins-regular text-[#727B96]">
                {selectedLanguage.learnerCountLabel}
              </Text>
            </View>
            <Ionicons color="#9AA1B3" name="chevron-forward" size={18} />
          </TouchableOpacity>
        </View>

        {/* Account actions */}
        <View className="mt-6">
          <Text className="mb-2 text-[13px] leading-[18px] font-poppins-semibold uppercase tracking-[1px] text-[#8B94A8]">
            Account
          </Text>

          <TouchableOpacity
            activeOpacity={0.82}
            className="flex-row items-center rounded-[14px] border border-[#EEF1F7] bg-white px-4 py-4"
            onPress={() => router.push("/language-selection")}
            style={styles.rowShadow}
          >
            <Ionicons color="#5B3BF6" name="language" size={22} />
            <Text className="ml-3 flex-1 text-[15px] leading-[21px] font-poppins-medium text-text-primary">
              Change Language
            </Text>
            <Ionicons color="#9AA1B3" name="chevron-forward" size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            className="mt-3 flex-row items-center rounded-[14px] border border-[#FFE5E5] bg-[#FFF5F5] px-4 py-4"
            onPress={() => void handleSignOut()}
            style={styles.rowShadow}
          >
            <Ionicons color="#D14343" name="log-out-outline" size={22} />
            <Text className="ml-3 flex-1 text-[15px] leading-[21px] font-poppins-medium text-[#D14343]">
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type StatItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
};

function StatItem({ icon, iconColor, label, value }: StatItemProps) {
  return (
    <View className="flex-1 items-center">
      <Ionicons color={iconColor} name={icon} size={22} />
      <Text className="mt-1 text-[16px] leading-[22px] font-poppins-semibold text-text-primary">
        {value}
      </Text>
      <Text className="text-[11px] leading-[16px] font-poppins-regular text-[#727B96]">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarShadow: {
    elevation: 4,
    shadowColor: "#5B3BF6",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  rowShadow: {
    elevation: 2,
    shadowColor: "#0D132B",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
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
  statCard: {
    elevation: 3,
    shadowColor: "#0D132B",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
});
