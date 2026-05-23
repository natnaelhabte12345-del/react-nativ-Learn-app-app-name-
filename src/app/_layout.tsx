import "../../global.css";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Text, View } from "react-native";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

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

  useEffect(() => {
    if (!isLoaded) {
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
      router.replace("/language-selection");
    }
  }, [isLoaded, isSignedIn, pathname]);

  return null;
}
