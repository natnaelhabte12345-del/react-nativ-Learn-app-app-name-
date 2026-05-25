import "../../global.css";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { router, Stack, type Href, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Text, View } from "react-native";

import { useLanguageStore } from "@/store/language-store";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const homeHref = "/" as Href;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    "Poppins-Bold": require("../../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-Medium": require("../../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-Regular": require("../../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-SemiBold": require("../../assets/fonts/Poppins-SemiBold.ttf"),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [error, loaded]);

  if (!loaded && !error) {
    return null;
  }

  if (!publishableKey) {
    return <MissingClerkKeyScreen />;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthRedirects />
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  );
}

function MissingClerkKeyScreen() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        flex: 1,
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: "#0D132B",
          fontFamily: "Poppins-SemiBold",
          fontSize: 20,
          lineHeight: 28,
          textAlign: "center",
        }}
      >
        Missing Clerk key
      </Text>
      <Text
        style={{
          color: "#6f7896",
          fontFamily: "Poppins-Regular",
          fontSize: 15,
          lineHeight: 23,
          marginTop: 10,
          textAlign: "center",
        }}
      >
        Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to a root .env file, then restart
        Expo.
      </Text>
    </View>
  );
}

function AuthRedirects() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const selectedLanguageId = useLanguageStore(
    (state) => state.selectedLanguageId,
  );

  useEffect(() => {
    if (!isLoaded || !hasHydrated) {
      return;
    }

    const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
    const isOnboardingRoute = pathname === "/onboarding";
    const isOAuthCallbackRoute = pathname === "/oauth-callback";
    const isLanguageSelectionRoute = pathname === "/language-selection";
    const hasSelectedLanguage = selectedLanguageId !== null;

    if (
      !isSignedIn &&
      !isAuthRoute &&
      !isOnboardingRoute &&
      !isOAuthCallbackRoute
    ) {
      router.replace("/onboarding");
      return;
    }

    if (isSignedIn && (isAuthRoute || isOnboardingRoute)) {
      router.replace(hasSelectedLanguage ? homeHref : "/language-selection");
      return;
    }

    if (
      isSignedIn &&
      !hasSelectedLanguage &&
      !isLanguageSelectionRoute &&
      !isOAuthCallbackRoute
    ) {
      router.replace("/language-selection");
    }
  }, [hasHydrated, isLoaded, isSignedIn, pathname, selectedLanguageId]);

  return null;
}
