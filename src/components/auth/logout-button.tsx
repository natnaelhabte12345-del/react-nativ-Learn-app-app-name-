import { useAuth, useClerk } from "@clerk/expo";
import { router } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { Alert, Text, TouchableOpacity } from "react-native";

type LogoutButtonProps = {
  label?: string;
  variant?: "pill" | "text";
};

export function LogoutButton({
  label = "Log out",
  variant = "pill",
}: LogoutButtonProps) {
  const posthog = usePostHog();
  const { userId } = useAuth();
  const { signOut } = useClerk();
  const isTextVariant = variant === "text";

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to sign out", error);
      }
      Alert.alert("Could not log out", "Please try again in a moment.");
      return;
    }

    try {
      if (userId) {
        posthog.identify(userId);
      }

      posthog.capture("sign_out_completed");
      await posthog.flush();
      posthog.reset();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to track sign out", error);
      }
    }

    router.replace("/onboarding");
  };

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      className={
        isTextVariant
          ? "h-[48px] items-center justify-center px-4"
          : "h-[30px] items-center justify-center rounded-full border border-[#eceef5] bg-white px-3"
      }
      onPress={handleLogout}
      testID="logout-button"
    >
      <Text
        className={
          isTextVariant
            ? "text-[18px] leading-[25px] font-poppins-medium text-[#767487]"
            : "text-[11px] leading-[15px] font-poppins-semibold text-lingua-deep-purple"
        }
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
