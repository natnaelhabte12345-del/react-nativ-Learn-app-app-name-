import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";

WebBrowser.maybeCompleteAuthSession();

export default function OAuthCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AppLoadingScreen message="Finishing sign in..." />;
  }

  if (isSignedIn) {
    return <Redirect href="/language-selection" />;
  }

  return <Redirect href="/sign-in" />;
}
