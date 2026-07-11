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
import { PostHogProvider, usePostHog } from "posthog-react-native";
import { useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import "../../global.css";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { selectOnboardingHref, useLanguageStore } from "@/store/language-store";

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

  if (!loaded && !error) {
    return <AppLoadingScreen message="Loading app..." />;
  }

  if (!publishableKey) {
    return <MissingClerkKeyScreen />;
  }

  if (posthogKey) {
    return (
      <PostHogProvider
        apiKey={posthogKey}
        options={{ host: posthogHost }}
        autocapture={{
          captureScreens: false,
          captureTouches: false,
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

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthRedirects />
      <PostHogScreenTracker />
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
  // The next onboarding step still needed (native → target → track), or null
  // once the learner has completed all three.
  const onboardingHref = useLanguageStore(selectOnboardingHref);

  useEffect(() => {
    if (!isLoaded || !hasHydrated) {
      return;
    }

    const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
    const isOnboardingRoute = pathname === "/onboarding";
    const isOAuthCallbackRoute = pathname === "/oauth-callback";

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
      router.replace((onboardingHref ?? homeHref) as Href);
      return;
    }

    // Keep signed-in users on the correct next onboarding step until all three
    // choices are made, without bouncing them off the step they're already on.
    if (
      isSignedIn &&
      onboardingHref &&
      pathname !== onboardingHref &&
      !isOAuthCallbackRoute
    ) {
      router.replace(onboardingHref as Href);
    }
  }, [hasHydrated, isLoaded, isSignedIn, pathname, onboardingHref]);

  return null;
}

function PostHogScreenTracker() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const posthog = usePostHog();
  const lastTrackedScreen = useRef<string | null>(null);
  const hasHydrated = useLanguageStore((state) => state.hasHydrated);
  const onboardingHref = useLanguageStore(selectOnboardingHref);

  // Memoize screen properties to avoid unnecessary analytics events from
  // recreating the object on every render. The screenKey only changes when
  // the actual route params change, preventing duplicate track calls.
  const screenProperties = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(params).sort(([leftKey], [rightKey]) =>
          leftKey.localeCompare(rightKey),
        ),
      ),
    [params],
  );

  useEffect(() => {
    if (
      !isLoaded ||
      !hasHydrated ||
      !shouldTrackScreen(pathname, isSignedIn === true, onboardingHref === null)
    ) {
      return;
    }

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
    screenProperties,
    pathname,
    posthog,
    onboardingHref,
  ]);

  return null;
}

const ONBOARDING_SELECTION_ROUTES = [
  "/native-language",
  "/language-selection",
  "/track-selection",
];

function shouldTrackScreen(
  pathname: string,
  isSignedIn: boolean,
  onboardingComplete: boolean,
) {
  const isAuthRoute = pathname === "/sign-in" || pathname === "/sign-up";
  const isOnboardingRoute = pathname === "/onboarding";
  const isOAuthCallbackRoute = pathname === "/oauth-callback";

  if (!isSignedIn) {
    return isAuthRoute || isOnboardingRoute || isOAuthCallbackRoute;
  }

  if (isAuthRoute || isOnboardingRoute) {
    return false;
  }

  if (!onboardingComplete) {
    return ONBOARDING_SELECTION_ROUTES.includes(pathname) || isOAuthCallbackRoute;
  }

  return true;
}
