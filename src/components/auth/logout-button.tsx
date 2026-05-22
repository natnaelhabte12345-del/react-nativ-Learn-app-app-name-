import { useClerk } from "@clerk/expo";
import { router } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

export function LogoutButton() {
  const { signOut } = useClerk();

  const handleLogout = async () => {
    await signOut();
    router.replace("/onboarding");
  };

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      className="h-[30px] items-center justify-center rounded-full border border-[#eceef5] bg-white px-3"
      onPress={handleLogout}
    >
      <Text className="text-[11px] leading-[15px] font-poppins-semibold text-lingua-deep-purple">
        Log out
      </Text>
    </TouchableOpacity>
  );
}
