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

const ACTIVE_COLOR = "#6E48F6";
const INACTIVE_COLOR = "#7E849E";
const BAR_MAX_WIDTH = 470;
const BAR_HORIZONTAL_MARGIN = 12;
const BAR_INNER_PADDING = 8;

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
  const barWidth = Math.min(width - BAR_HORIZONTAL_MARGIN * 2, BAR_MAX_WIDTH);
  const itemWidth = (barWidth - BAR_INNER_PADDING * 2) / routes.length;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabBarOuter,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View style={[styles.tabBar, { width: barWidth }]}>
        {routes.map((route, index) => {
          const config = tabConfigs[route.name] ?? tabConfigs.index;
          const isFocused = state.index === index;
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
                { opacity: pressed ? 0.72 : 1, width: itemWidth },
              ]}
            >
              <TabIcon
                icon={isFocused ? config.activeIcon : config.icon}
                size={27}
              />
              <Text
                style={[
                  styles.tabLabel,
                  isFocused && styles.activeTabLabel,
                ]}
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
  activeTabLabel: {
    color: ACTIVE_COLOR,
  },
  tabBar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    flexDirection: "row",
    height: 86,
    paddingHorizontal: BAR_INNER_PADDING,
    elevation: 12,
    shadowColor: "#0D132B",
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  tabBarOuter: {
    alignItems: "center",
    backgroundColor: "transparent",
    bottom: 0,
    left: 0,
    paddingHorizontal: BAR_HORIZONTAL_MARGIN,
    paddingTop: 8,
    position: "absolute",
    right: 0,
  },
  tabItem: {
    alignItems: "center",
    height: 76,
    justifyContent: "center",
    paddingTop: 6,
    zIndex: 1,
  },
  tabLabel: {
    color: INACTIVE_COLOR,
    fontFamily: "Poppins-SemiBold",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
    textAlign: "center",
  },
});
