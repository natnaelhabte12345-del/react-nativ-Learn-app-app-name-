import { useAuth } from "@clerk/expo";
import { Redirect, router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { useLanguageStore } from "@/store/language-store";

// The languages the app can explain lessons in. Kept in sync with the chat
// API's native-language allow-list (src/app/api/chat+api.ts).
const NATIVE_LANGUAGES = [
  { id: "english", name: "English", flag: "🇬🇧" },
  { id: "spanish", name: "Spanish", flag: "🇪🇸" },
  { id: "french", name: "French", flag: "🇫🇷" },
  { id: "german", name: "German", flag: "🇩🇪" },
  { id: "portuguese", name: "Portuguese", flag: "🇵🇹" },
  { id: "italian", name: "Italian", flag: "🇮🇹" },
  { id: "turkish", name: "Turkish", flag: "🇹🇷" },
  { id: "arabic", name: "Arabic", flag: "🇸🇦" },
];

export default function NativeLanguageScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const nativeLanguageId = useLanguageStore((state) => state.nativeLanguageId);
  const setNativeLanguage = useLanguageStore((state) => state.setNativeLanguage);

  if (!isLoaded || !hasHydrated) {
    return <AppLoadingScreen message="Loading..." />;
  }
  if (!isSignedIn) {
    return <Redirect href="/onboarding" />;
  }

  function handleSelect(id: string) {
    setNativeLanguage(id);
    router.replace("/language-selection");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[13px] leading-[18px] font-poppins-semibold uppercase tracking-[1.5px] text-lingua-deep-purple">
          Step 1 of 3
        </Text>
        <Text className="mt-2 text-[28px] leading-[35px] font-poppins-bold text-text-primary">
          What language do you speak?
        </Text>
        <Text className="mt-2 text-[15px] leading-[22px] font-poppins-regular text-[#6F7896]">
          We&apos;ll explain everything in this language while you learn.
        </Text>

        <View className="mt-6">
          {NATIVE_LANGUAGES.map((language) => {
            const isSelected = nativeLanguageId === language.id;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                key={language.id}
                onPress={() => handleSelect(language.id)}
                style={[styles.row, isSelected ? styles.rowSelected : null]}
              >
                <Text className="text-[26px]">{language.flag}</Text>
                <Text className="ml-4 flex-1 text-[16px] leading-[21px] font-poppins-semibold text-text-primary">
                  {language.name}
                </Text>
                <View
                  className={
                    isSelected
                      ? "h-[26px] w-[26px] items-center justify-center rounded-full bg-lingua-deep-purple"
                      : "h-[26px] w-[26px] rounded-full border-2 border-[#D6DAE6]"
                  }
                >
                  {isSelected ? (
                    <Text className="text-[15px] font-poppins-bold text-white">✓</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0F1F6",
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    marginBottom: 10,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  rowSelected: {
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
