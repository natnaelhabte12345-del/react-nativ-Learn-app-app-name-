import { Text, View } from "react-native";

type TypographyRowProps = {
  label: string;
  lineHeight: string;
  previewClassName: string;
  role: string;
  size: string;
  weight: string;
};

export function TypographyRow({
  label,
  lineHeight,
  previewClassName,
  role,
  size,
  weight,
}: TypographyRowProps) {
  return (
    <View className="flex-row items-start border-b border-[#f1f4fa] py-5 last:border-b-0">
      <View className="w-[88px]">
        <Text className={previewClassName}>{label}</Text>
      </View>
      <View className="flex-1 px-4">
        <Text className="text-body-md font-poppins-regular text-text-secondary">
          {role}
        </Text>
      </View>
      <Text className="w-[56px] text-body-md font-poppins-regular text-text-secondary">
        {size}
      </Text>
      <Text className="w-[84px] text-body-md font-poppins-regular text-text-secondary">
        {weight}
      </Text>
      <Text className="w-[36px] text-right text-body-md font-poppins-regular text-text-secondary">
        {lineHeight}
      </Text>
    </View>
  );
}
