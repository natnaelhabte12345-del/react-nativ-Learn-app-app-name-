import { useAuth } from "@clerk/expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, router, type Href } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { defaultLanguageId, languages } from "@/data/languages";
import { tracks } from "@/data/tracks";
import { getTrackLessons } from "@/lib/tracks";
import { useLanguageStore } from "@/store/language-store";
import type { TrackId } from "@/types/learning";

export default function TrackSelectionScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const selectedLanguageId =
    useLanguageStore((state) => state.selectedLanguageId) ?? defaultLanguageId;
  const trackId = useLanguageStore((state) => state.trackId);
  const setTrack = useLanguageStore((state) => state.setTrack);

  if (!isLoaded || !hasHydrated) {
    return <AppLoadingScreen message="Loading..." />;
  }
  if (!isSignedIn) {
    return <Redirect href="/onboarding" />;
  }

  const languageName =
    languages.find((language) => language.id === selectedLanguageId)?.name ??
    "your language";

  function handleSelect(id: TrackId) {
    setTrack(id);
    router.replace("/" as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[13px] leading-[18px] font-poppins-semibold uppercase tracking-[1.5px] text-lingua-deep-purple">
          Step 3 of 3
        </Text>
        <Text className="mt-2 text-[28px] leading-[35px] font-poppins-bold text-text-primary">
          What&apos;s your goal in {languageName}?
        </Text>
        <Text className="mt-2 text-[15px] leading-[22px] font-poppins-regular text-[#6F7896]">
          Pick where to start — you can switch anytime.
        </Text>

        <View className="mt-6">
          {tracks.map((track) => {
            const count = getTrackLessons(selectedLanguageId, track.id).length;
            const isSelected = trackId === track.id;
            const disabled = count === 0;
            return (
              <TouchableOpacity
                activeOpacity={0.88}
                disabled={disabled}
                key={track.id}
                onPress={() => handleSelect(track.id)}
                style={[
                  styles.card,
                  isSelected ? styles.cardSelected : null,
                  disabled ? styles.cardDisabled : null,
                ]}
              >
                <View
                  className="h-[46px] w-[46px] items-center justify-center rounded-[13px]"
                  style={{ backgroundColor: track.accent }}
                >
                  <Ionicons color="#FFFFFF" name={track.icon as never} size={24} />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-[17px] leading-[22px] font-poppins-bold text-text-primary">
                    {track.title}
                  </Text>
                  <Text className="mt-0.5 text-[13px] leading-[18px] font-poppins-regular text-[#6F7896]">
                    {track.subtitle}
                  </Text>
                  <Text className="mt-1 text-[12px] leading-[16px] font-poppins-semibold text-[#9AA1B3]">
                    {disabled ? "Coming soon" : `${count} lessons`}
                  </Text>
                </View>
                <Ionicons
                  color={isSelected ? "#5B3BF6" : "#C6CBDA"}
                  name={isSelected ? "checkmark-circle" : "chevron-forward"}
                  size={22}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0F1F6",
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: "row",
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardSelected: {
    backgroundColor: "#FCFBFF",
    borderColor: "#9278FF",
  },
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  scroll: {
    paddingBottom: 30,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
});
