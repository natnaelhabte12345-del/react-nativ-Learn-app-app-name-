import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { images } from "@/constants/images";

// Placeholder hero illustration. Swap this single line for a dedicated
// open-chest + mascot illustration (e.g. images.rewardChest) for the
// pixel-perfect reward design.
const heroImage = images.treasure;

// Confetti pieces scattered around the chest. Positions/rotations are fixed so
// the layout stays stable; colours echo the app's playful palette.
const confetti = [
  { color: "#5B3BF6", left: "12%", rotate: "20deg", top: "6%" },
  { color: "#FF7A00", left: "30%", rotate: "-15deg", top: "2%" },
  { color: "#25C636", left: "52%", rotate: "35deg", top: "8%" },
  { color: "#F5C518", left: "74%", rotate: "-25deg", top: "3%" },
  { color: "#5B3BF6", left: "86%", rotate: "10deg", top: "14%" },
  { color: "#FF7A00", left: "6%", rotate: "-30deg", top: "26%" },
  { color: "#25C636", left: "90%", rotate: "40deg", top: "34%" },
  { color: "#F5C518", left: "20%", rotate: "15deg", top: "40%" },
] as const;

type DailyRewardModalProps = {
  bonusXp: number;
  onClaim: () => void;
  visible: boolean;
};

export function DailyRewardModal({
  bonusXp,
  onClaim,
  visible,
}: DailyRewardModalProps) {
  // Spring pop-in for the card whenever the modal becomes visible.
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scale.setValue(0.8);
      opacity.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.spring(scale, {
        bounciness: 9,
        speed: 12,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, scale, opacity]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClaim}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Animated.View
          className="w-full max-w-[340px] items-center rounded-[28px] bg-white px-6 pb-6 pt-7"
          style={[styles.card, { opacity, transform: [{ scale }] }]}
        >
          {/* Hero: glow + chest + confetti */}
          <View className="h-[180px] w-full items-center justify-center">
            <View style={styles.glow} />
            {confetti.map((piece, index) => (
              <View
                key={index}
                style={[
                  styles.confettiPiece,
                  {
                    backgroundColor: piece.color,
                    left: piece.left,
                    top: piece.top,
                    transform: [{ rotate: piece.rotate }],
                  },
                ]}
              />
            ))}
            <Image
              resizeMode="contain"
              source={heroImage}
              style={styles.heroImage}
            />
          </View>

          <Text className="mt-3 text-center text-[26px] leading-[32px] font-poppins-bold text-[#101936]">
            Daily Goal Complete!
          </Text>
          <Text className="mt-2 text-center text-[16px] leading-[22px] font-poppins-medium text-[#727B96]">
            You earned +{bonusXp} bonus XP
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            className="mt-6 h-[56px] w-full items-center justify-center rounded-[18px] bg-lingua-deep-purple"
            onPress={onClaim}
            style={styles.claimButton}
          >
            <Text className="text-[18px] leading-[24px] font-poppins-semibold text-white">
              Claim
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(13, 19, 43, 0.45)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    elevation: 14,
    shadowColor: "#0D132B",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
  },
  claimButton: {
    elevation: 6,
    shadowColor: "#321D93",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  confettiPiece: {
    borderRadius: 2,
    height: 12,
    position: "absolute",
    width: 7,
  },
  glow: {
    backgroundColor: "#FFF3D6",
    borderRadius: 90,
    height: 150,
    opacity: 0.7,
    position: "absolute",
    width: 150,
  },
  heroImage: {
    height: 150,
    width: 170,
  },
});
