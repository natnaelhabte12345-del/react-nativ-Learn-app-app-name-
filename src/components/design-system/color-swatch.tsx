import { Text, View } from "react-native";

type ColorSwatchProps = {
  bordered?: boolean;
  className?: string;
  hex: string;
  name: string;
};

export function ColorSwatch({
  bordered = false,
  className = "",
  hex,
  name,
}: ColorSwatchProps) {
  return (
    <View className="mr-5 mb-7 w-[110px]">
      <View
        className={[
          "h-[82px] w-[82px] rounded-[14px]",
          bordered ? "border border-border" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <Text className="mt-3 text-body-sm font-poppins-semibold text-text-secondary">
        {name}
      </Text>
      <Text className="text-body-sm font-poppins-regular text-text-secondary">
        {hex}
      </Text>
    </View>
  );
}
