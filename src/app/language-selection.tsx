import { useAuth } from "@clerk/expo";
import { Redirect, router, type Href } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useMemo, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LogoutButton } from "@/components/auth/logout-button";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { images } from "@/constants/images";
import { defaultLanguageId, languages } from "@/data/languages";
import { identifyUser, trackLanguageSelected } from "@/lib/analytics";
import { useLanguageStore } from "@/store/language-store";
import type { LanguageId, LearningLanguage } from "@/types/learning";

const homeHref = "/" as Href;

export default function LanguageSelectionScreen() {
  const posthog = usePostHog();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const persistedLanguageId = useLanguageStore(
    (state) => state.selectedLanguageId,
  );
  const setSelectedLanguage = useLanguageStore(
    (state) => state.setSelectedLanguage,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguageId, setSelectedLanguageId] =
    useState<LanguageId | null>(null);
  const visibleSelectedLanguageId =
    selectedLanguageId ?? persistedLanguageId ?? defaultLanguageId;

  const visibleLanguages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return languages;
    }

    return languages.filter((language) =>
      language.name.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  const handleSelectLanguage = (languageId: LanguageId) => {
    const language = languages.find((item) => item.id === languageId);
    trackLanguageSelected(posthog, {
      language_code: languageId,
      language_name: language?.name ?? languageId,
    });
    // Keep the person's preferred_language current now that they've chosen one.
    if (userId) {
      identifyUser(posthog, userId, languageId);
    }
    setSelectedLanguageId(languageId);
    setSelectedLanguage(languageId);
    router.replace(homeHref);
  };

  if (!isLoaded || !hasHydrated) {
    return <AppLoadingScreen message="Loading languages..." />;
  }

  if (!isSignedIn) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="relative h-[48px] flex-row items-center justify-center">
          <TouchableOpacity
            activeOpacity={0.75}
            className="absolute left-0 h-[44px] w-[44px] items-start justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-[42px] leading-[42px] font-poppins-regular text-text-primary">
              {"\u2039"}
            </Text>
          </TouchableOpacity>

          <Text className="text-[19px] leading-[25px] font-poppins-semibold text-text-primary">
            Choose a language
          </Text>

          <View className="absolute right-0">
            <LogoutButton />
          </View>
        </View>

        <View className="mt-4 h-[50px] flex-row items-center rounded-[25px] border border-[#e7e9f0] bg-[#fafbff] px-5">
          <Text className="mr-3.5 text-[23px] leading-[23px] text-[#5f6886]">
            {"\u2315"}
          </Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setSearchQuery}
            placeholder="Search languages"
            placeholderTextColor="#68718f"
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>

        <Text className="mt-5 text-[18px] leading-[24px] font-poppins-semibold text-text-primary">
          Popular
        </Text>

        <View className="mt-3">
          {visibleLanguages.map((language, index) => (
            <LanguageRow
              isSelected={language.id === visibleSelectedLanguageId}
              key={language.id}
              language={language}
              onSelect={() => handleSelectLanguage(language.id)}
              showDivider={index < visibleLanguages.length - 1}
            />
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.82}
          className="mt-6 h-[62px] justify-center"
          onPress={() => setSearchQuery("")}
        >
          <Image
            source={images.seeAllLanguagesButton}
            className="h-[62px] w-full"
            resizeMode="contain"
          />
        </TouchableOpacity>

        <View className="mt-3 h-[178px] items-center justify-end overflow-visible">
          <Image
            source={images.languageWorld}
            className="-mb-1 h-[172px] w-[520px]"
            resizeMode="contain"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type LanguageRowProps = {
  isSelected: boolean;
  language: LearningLanguage;
  onSelect: () => void;
  showDivider: boolean;
};

function LanguageRow({
  isSelected,
  language,
  onSelect,
  showDivider,
}: LanguageRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="h-[62px] flex-row items-center rounded-[20px] bg-white px-5"
      onPress={onSelect}
      style={[
        styles.languageRow,
        isSelected && styles.selectedLanguageRow,
        showDivider && styles.languageRowSpacing,
      ]}
      testID={`language-option-${language.id}`}
    >
      <FlagMark languageId={language.id} />

      <View className="ml-3.5 flex-1">
        <Text className="text-[16px] leading-[21px] font-poppins-semibold text-text-primary">
          {language.name}
        </Text>
        <Text className="mt-0.5 text-[12px] leading-[17px] font-poppins-regular text-[#737b96]">
          {language.learnerCountLabel}
        </Text>
      </View>

      {isSelected ? (
        <View className="h-[29px] w-[29px] items-center justify-center rounded-full bg-[#6E48F6]">
          <Text className="text-[20px] leading-[23px] font-poppins-semibold text-white">
            {"\u2713"}
          </Text>
        </View>
      ) : (
        <Text className="text-[27px] leading-[27px] font-poppins-regular text-[#68718f]">
          {"\u203A"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const flagImages: Record<LanguageId, ImageSourcePropType> = {
  chinese: images.flagChinese,
  french: images.flagFrench,
  german: images.flagGerman,
  japanese: images.flagJapanese,
  korean: images.flagKorean,
  spanish: images.flagSpanish,
};

function FlagMark({ languageId }: { languageId: LanguageId }) {
  return (
    <View className="h-[38px] w-[38px] overflow-hidden rounded-full bg-white">
      <Image
        source={flagImages[languageId]}
        className="h-full w-full"
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
    paddingHorizontal: 28,
    paddingTop: 10,
  },
  searchInput: {
    color: "#0D132B",
    flex: 1,
    fontFamily: "Poppins-Regular",
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
  },
  languageRow: {
    borderColor: "#F3F4F9",
    borderRadius: 20,
    borderWidth: 1,
  },
  languageRowSpacing: {
    marginBottom: 4,
  },
  selectedLanguageRow: {
    backgroundColor: "#FCFBFF",
    borderColor: "#9278FF",
    borderRadius: 22,
    borderWidth: 1.25,
  },
});
