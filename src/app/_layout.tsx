import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import {
  router,
  Stack,
  useGlobalSearchParams,
  usePathname,
  type Href,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { PostHogProvider, usePostHog } from "posthog-react-native";
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import "../../global.css";

import { useLanguageStore } from "@/store/language-store";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
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
    <PostHogProvider
      apiKey={posthogKey}
      options={{ host: posthogHost }}
      autocapture={{
        captureScreens: false,
        captureTouches: true,
        propsToCapture: ["testID"],
        maxElementsCaptured: 20,
      }}
    >
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <AuthRedirects />
        <PostHogScreenTracker />
        <Stack screenOptions={{ headerShown: false }} />
      </ClerkProvider>
    </PostHogProvider>
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

function PostHogScreenTracker() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const posthog = usePostHog();
  const lastTrackedScreen = useRef<string | null>(null);
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const selectedLanguageId = useLanguageStore(
    (state) => state.selectedLanguageId,
  );

  useEffect(() => {
    if (
      !isLoaded ||
      !hasHydrated ||
      !shouldTrackScreen(pathname, isSignedIn === true, selectedLanguageId)
    ) {
      return;
    }

    const screenProperties = Object.fromEntries(
      Object.entries(params).sort(([leftKey], [rightKey]) =>
        leftKey.localeCompare(rightKey),
      ),
    );
    const screenKey = `${pathname}:${JSON.stringify(screenProperties)}`;

    if (lastTrackedScreen.current === screenKey) {
      return;
    }

    lastTrackedScreen.current = screenKey;
    void posthog.screen(pathname, screenProperties);
  }, [
    hasHydrated,
    isLoaded,
    isSignedIn,
    params,
    pathname,
    posthog,
    selectedLanguageId,
  ]);

  return null;
}

function shouldTrackScreen(
  pathname: string,
  isSignedIn: boolean,
  selectedLanguageId: string | null,
) {
  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
  const isOnboardingRoute = pathname === "/onboarding";
  const isOAuthCallbackRoute = pathname === "/oauth-callback";
  const isLanguageSelectionRoute = pathname === "/language-selection";

  if (!isSignedIn) {
    return isAuthRoute || isOnboardingRoute || isOAuthCallbackRoute;
  }

  if (isAuthRoute || isOnboardingRoute) {
    return false;
  }

  if (!selectedLanguageId) {
    return isLanguageSelectionRoute || isOAuthCallbackRoute;
  }

  return true;
}
