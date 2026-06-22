import { useAuth } from "@clerk/expo";
import { Link, Redirect } from "expo-router";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { images } from "@/constants/images";
import { useLanguageStore } from "@/store/language-store";

export default function OnboardingScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  const selectedLanguageId = useLanguageStore((state) => state.selectedLanguageId);
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);

  if (!isLoaded) {
    return <AppLoadingScreen message="Loading sign in..." />;
  }

  if (isSignedIn && hasHydrated) {
    const hasSelectedLanguage = selectedLanguageId !== null;
    return <Redirect href={hasSelectedLanguage ? "/" : "/language-selection"} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View className="flex-1 bg-background px-7 pt-3 pb-6">
        <View className="pt-6">
          <View className="flex-row items-center gap-3">
            <Image
              source={images.mascotLogo}
              className="h-[42px] w-[42px]"
              resizeMode="contain"
            />
            <Text className="text-[24px] leading-[28px] font-poppins-semibold text-text-primary">
              FluentFlow
            </Text>
          </View>
        </View>

        <View className="mt-12">
          <Text className="max-w-[330px] text-[38px] leading-[48px] font-poppins-semibold tracking-[-1px] text-text-primary">
            Your AI language
          </Text>
          <Text className="mt-1 text-[38px] leading-[48px] font-poppins-semibold tracking-[-1px] text-lingua-deep-purple">
            teacher.
          </Text>
          <Text className="mt-5 max-w-[320px] text-[16px] leading-[26px] font-poppins-regular text-text-secondary">
            Real conversations, personalized lessons, anytime, anywhere.
          </Text>
        </View>

        <View className="relative mt-6 flex-1 items-center justify-end">
          <View
            className="absolute z-10 ff-bubble bg-[#eef5ff] px-5 py-3"
            style={{
              left: 6,
              top: 54,
              transform: [{ rotate: "-11deg" }],
            }}
          >
            <Text className="text-[18px] leading-[24px] font-poppins-medium text-[#111111]">
              Hello!
            </Text>
          </View>

          <View
            className="absolute z-10 ff-bubble bg-[#f5f2ff] px-5 py-3"
            style={{
              right: 10,
              top: 18,
              transform: [{ rotate: "13deg" }],
            }}
          >
            <Text className="text-[18px] leading-[24px] font-poppins-semibold text-lingua-deep-purple">
              {"\u00A1Hola!"}
            </Text>
          </View>

          <View
            className="absolute z-10 ff-bubble bg-[#fff4ef] px-5 py-3"
            style={{
              right: 20,
              top: 152,
              transform: [{ rotate: "4deg" }],
            }}
          >
            <Text className="text-[18px] leading-[24px] font-poppins-semibold text-[#ff5f39]">
              {"\u4F60\u597D!"}
            </Text>
          </View>

          <Image
            source={images.mascotWelcome}
            className="mb-2 h-[300px] w-[300px]"
            resizeMode="contain"
          />
        </View>

        <View className="pt-4">
          <Link href="/sign-up" asChild>
            <TouchableOpacity
              activeOpacity={0.9}
              className="ff-primary-button flex-row items-center justify-center py-5"
            >
              <Text className="text-[20px] leading-[26px] font-poppins-semibold text-white">
                Get Started
              </Text>
              <Text className="ml-5 text-[30px] leading-[30px] font-poppins-regular text-white">
                {"\u203A"}
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
