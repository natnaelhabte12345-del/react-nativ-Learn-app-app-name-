import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { images } from "@/constants/images";

type TabConfig = {
  activeIcon: ImageSourcePropType;
  icon: ImageSourcePropType;
  label: string;
};

const BAR_MAX_WIDTH = 470;
const BAR_HORIZONTAL_MARGIN = 12;

const tabConfigs: Record<string, TabConfig> = {
  index: {
    activeIcon: images.tabHomeActive,
    icon: images.tabHome,
    label: "Home",
  },
  learn: {
    activeIcon: images.tabLearnActive,
    icon: images.tabLearn,
    label: "Learn",
  },
  "ai-teacher": {
    activeIcon: images.tabAiTeacherActive,
    icon: images.tabAiTeacher,
    label: "AI Teacher",
  },
  chat: {
    activeIcon: images.tabChatActive,
    icon: images.tabChat,
    label: "Chat",
  },
  profile: {
    activeIcon: images.tabProfileActive,
    icon: images.tabProfile,
    label: "Profile",
  },
};

export function CustomTabBar({
  descriptors,
  navigation,
  state,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const routes = state.routes;
  const visibleRoutes = routes.filter((route) => route.name in tabConfigs);
  const focusedRouteKey = routes[state.index]?.key;
  const barWidth = Math.min(width - BAR_HORIZONTAL_MARGIN * 2, BAR_MAX_WIDTH);

  return (
    <View
      className="absolute bottom-0 left-0 right-0 items-center bg-transparent px-3 pt-2"
      pointerEvents="box-none"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      <View
        className="h-[86px] flex-row items-center rounded-[30px] bg-white px-2"
        style={[styles.tabBarShadow, { width: barWidth }]}
      >
        {visibleRoutes.map((route) => {
          const config = tabConfigs[route.name] ?? tabConfigs.index;
          const isFocused = focusedRouteKey === route.key;
          const options = descriptors[route.key]?.options;
          const accessibilityLabel =
            options?.tabBarAccessibilityLabel ?? config.label;

          const onPress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: "tabPress",
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              accessibilityLabel={accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabItem,
                { opacity: pressed ? 0.72 : 1 },
              ]}
            >
              <TabIcon
                icon={isFocused ? config.activeIcon : config.icon}
                size={27}
              />
              <Text
                className={`mt-[5px] w-full text-center text-[11px] leading-4 font-poppins-semibold ${
                  isFocused ? "text-[#6E48F6]" : "text-[#7E849E]"
                }`}
                numberOfLines={1}
              >
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type TabIconProps = {
  icon: ImageSourcePropType;
  size: number;
};

function TabIcon({ icon, size }: TabIconProps) {
  return (
    <Image
      resizeMode="contain"
      source={icon}
      style={{
        height: size,
        width: size,
      }}
    />
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: "center",
    flex: 1,
    height: 76,
    justifyContent: "center",
    minWidth: 0,
    paddingTop: 6,
    zIndex: 1,
  },
  tabBarShadow: {
    elevation: 12,
    shadowColor: "#0D132B",
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
});
