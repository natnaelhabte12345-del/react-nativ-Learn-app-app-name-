import { Image, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ColorSwatch } from "@/components/design-system/color-swatch";
import { TypographyRow } from "@/components/design-system/typography-row";
import { images } from "@/constants/images";
import {
  brandColors,
  neutralColors,
  semanticColors,
  typeScale,
} from "@/theme";

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="mb-7">
      <Text className="ds-section-title">{title}</Text>
      <View className="ds-divider mt-3" />
    </View>
  );
}

function ColorGroup({
  items,
  title,
}: {
  items: readonly {
    bordered?: boolean;
    hex: string;
    name: string;
    textClassName?: string;
    token: string;
  }[];
  title: string;
}) {
  return (
    <View className="mb-8">
      <Text className="ds-token-label mb-4">{title}</Text>
      <View className="flex-row flex-wrap">
        {items.map((item) => (
          <ColorSwatch
            key={item.name}
            bordered={item.bordered}
            className={item.token}
            hex={item.hex}
            name={item.name}
          />
        ))}
      </View>
    </View>
  );
}

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F7FB" }}>
      <ScrollView
        className="ds-screen"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-5">
          <View className="gap-5 xl:flex-row">
            <View className="flex-1 ds-card ds-card-padding">
              <SectionHeader title="Brand" />
              <View className="flex-row items-center justify-center gap-4 px-1 py-3">
                <Image
                  source={images.mascotLogo}
                  className="h-[122px] w-[122px]"
                  resizeMode="contain"
                />
                <Text className="text-[56px] leading-[62px] font-poppins-semibold text-text-primary">
                  lingua
                </Text>
              </View>
            </View>

            <View className="flex-1 ds-card ds-card-padding">
              <SectionHeader title="Typography" />
              <View className="mb-7">
                <Text className="ds-token-label mb-3">Font Family</Text>
                <Text className="text-[64px] leading-[72px] font-poppins-semibold text-text-primary">
                  Poppins
                </Text>
                <Text className="mt-4 max-w-[540px] text-body-lg font-poppins-regular text-text-secondary">
                  Poppins is a modern, geometric sans-serif typeface that
                  provides excellent readability and a friendly personality.
                </Text>
              </View>

              <View>
                {typeScale.map((item) => (
                  <TypographyRow key={item.label} {...item} />
                ))}
              </View>
            </View>
          </View>

          <View className="ds-card ds-card-padding">
            <SectionHeader title="Colors" />
            <ColorGroup items={brandColors} title="Primary" />
            <ColorGroup items={semanticColors} title="Semantic" />
            <ColorGroup items={neutralColors} title="Neutrals" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
