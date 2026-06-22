import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AppLoadingScreenProps = {
  message?: string;
};

export function AppLoadingScreen({
  message = "Loading...",
}: AppLoadingScreenProps) {
  return (
    <SafeAreaView style={{ backgroundColor: "#FFFFFF", flex: 1 }}>
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator color="#5B3BF6" size="large" />
        <Text className="mt-4 text-center text-[16px] leading-[23px] text-[#5E6785]">
          {message}
        </Text>
      </View>
    </SafeAreaView>
  );
}
