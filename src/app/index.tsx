import { useAuth } from "@clerk/expo";
import { Link, Redirect } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LogoutButton } from "@/components/auth/logout-button";
import { defaultLanguageId, languages } from "@/data/languages";

const defaultLanguage = languages.find(
  (language) => language.id === defaultLanguageId,
);

export default function HomeScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View className="flex-1 justify-center bg-background px-7">
        <View className="absolute right-7 top-5 z-10">
          <LogoutButton />
        </View>

        <Text className="text-[34px] leading-[42px] font-poppins-semibold text-text-primary">
          Fluentflow
        </Text>
        <Text className="mt-3 max-w-[300px] text-[16px] leading-[25px] font-poppins-regular text-[#6f7896]">
          Start learning with simple beginner lessons.
        </Text>

        <View className="mt-8 rounded-[24px] border border-[#eceef5] bg-white px-6 py-5">
          <Text className="text-[15px] leading-[22px] font-poppins-medium text-[#7b849f]">
            Selected language
          </Text>
          <Text className="mt-2 text-[24px] leading-[31px] font-poppins-semibold text-text-primary">
            {defaultLanguage?.name ?? "Spanish"}
          </Text>
          <Text className="mt-1 text-[14px] leading-[21px] font-poppins-regular text-[#6f7896]">
            {defaultLanguage?.description}
          </Text>
        </View>

        <Link href="/language-selection" asChild>
          <TouchableOpacity
            activeOpacity={0.88}
            className="mt-6 h-[64px] items-center justify-center rounded-[22px] bg-lingua-deep-purple"
          >
            <Text className="text-[19px] leading-[25px] font-poppins-semibold text-white">
              Choose language
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}
