import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TabPlaceholderScreenProps = {
  title: string;
};

export function TabPlaceholderScreen({ title }: TabPlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-[28px] leading-[36px] font-poppins-semibold text-text-primary">
          {title}
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-[22px] font-poppins-regular text-text-secondary">
          Placeholder screen
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
});
