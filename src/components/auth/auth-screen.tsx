import { router, type Href } from "expo-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";

type AuthMode = "sign-in" | "sign-up";

type AuthScreenProps = {
  mode: AuthMode;
};

type AuthCopy = {
  email: string;
  footerAction: string;
  footerHref: Href;
  footerText: string;
  primaryAction: string;
  socialTopSpacing: string;
  subtitle: string;
  title: string;
};

const CODE_LENGTH = 6;

const authCopy: Record<AuthMode, AuthCopy> = {
  "sign-up": {
    title: "Create your account",
    subtitle: "Start your language journey today",
    email: "alex@gmail.com",
    primaryAction: "Sign Up",
    footerText: "Already have an account?",
    footerAction: "Log in",
    footerHref: "/sign-in",
    socialTopSpacing: "pt-8",
  },
  "sign-in": {
    title: "Welcome back",
    subtitle: "Continue your language journey",
    email: "alex@gmail.com",
    primaryAction: "Sign In",
    footerText: "Don't have an account?",
    footerAction: "Sign up",
    footerHref: "/sign-up",
    socialTopSpacing: "pt-8",
  },
};

const socialOptions = [
  { label: "Continue with Google", provider: "google" },
  { label: "Continue with Facebook", provider: "facebook" },
  { label: "Continue with Apple", provider: "apple" },
] as const;

export function AuthScreen({ mode }: AuthScreenProps) {
  const copy = authCopy[mode];
  const [isModalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState("");
  const codeInputRef = useRef<TextInput>(null);

  const showVerification = () => {
    setCode("");
    setModalVisible(true);
  };

  const handleCodeChange = (value: string) => {
    const nextCode = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(nextCode);

    if (nextCode.length === CODE_LENGTH) {
      setModalVisible(false);
      router.replace("/");
    }
  };

  useEffect(() => {
    if (!isModalVisible) {
      return;
    }

    const timer = setTimeout(() => codeInputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [isModalVisible]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text className="text-[42px] leading-[42px] font-poppins-regular text-text-primary">
            {"\u2039"}
          </Text>
        </TouchableOpacity>

        <View className="mt-4">
          <Text
            className={
              mode === "sign-up"
                ? "text-[27px] leading-[33px] font-poppins-semibold tracking-[-1px] text-text-primary"
                : "text-[34px] leading-[40px] font-poppins-semibold tracking-[-1px] text-text-primary"
            }
            numberOfLines={1}
          >
            {copy.title}
          </Text>
          <Text className="mt-3 text-[17px] leading-[24px] font-poppins-regular text-[#6f7896]">
            {copy.subtitle} {"\u2728"}
          </Text>
        </View>

        <View className="relative mt-2 h-[152px] items-center justify-end overflow-hidden">
          <Text className="absolute left-[78px] top-[48px] z-10 text-[25px] leading-[28px] text-[#ff8a00]">
            {"\u2726"}
          </Text>
          <Text className="absolute right-[68px] top-[58px] z-10 text-[25px] leading-[28px] text-[#68a9ff]">
            {"\u2726"}
          </Text>
          <Text className="absolute right-[85px] top-[110px] z-10 text-[25px] leading-[28px] text-[#ffd45c]">
            {"\u2726"}
          </Text>
          <Image
            source={images.mascotAuth}
            className="h-[184px] w-[260px]"
            resizeMode="contain"
          />
        </View>

        <View className="-mt-10 gap-3">
          <View className="rounded-[20px] border border-[#eceef5] bg-white px-6 py-3">
            <Text className="text-[15px] leading-[20px] font-poppins-medium text-[#7b849f]">
              Email
            </Text>
            <TextInput
              autoCapitalize="none"
              defaultValue={copy.email}
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor="#0D132B"
              style={styles.input}
            />
          </View>

          {mode === "sign-up" ? (
            <View className="flex-row items-center rounded-[20px] border border-[#eceef5] bg-white px-6 py-3">
              <View className="flex-1">
                <Text className="text-[15px] leading-[20px] font-poppins-medium text-[#7b849f]">
                  Password
                </Text>
                <TextInput
                  defaultValue="password"
                  placeholder="Password"
                  placeholderTextColor="#0D132B"
                  secureTextEntry
                  style={styles.input}
                />
              </View>
              <Text className="text-[26px] leading-[30px] text-[#7b849f]">
                {"\u25CE"}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.9}
            className="mt-1 items-center justify-center rounded-[16px] bg-lingua-deep-purple py-[15px]"
            onPress={showVerification}
          >
            <Text className="text-[22px] leading-[28px] font-poppins-semibold text-white">
              {copy.primaryAction}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="my-4 flex-row items-center">
          <View className="h-px flex-1 bg-[#e7e9f0]" />
          <Text className="px-6 text-[16px] leading-[22px] font-poppins-regular text-[#7b849f]">
            or continue with
          </Text>
          <View className="h-px flex-1 bg-[#e7e9f0]" />
        </View>

        <View className="gap-3">
          {socialOptions.map((option) => (
            <TouchableOpacity
              activeOpacity={0.85}
              className="h-[55px] flex-row items-center rounded-[17px] border border-[#eef0f6] bg-white"
              key={option.label}
              onPress={showVerification}
            >
              <View style={styles.socialIconSlot}>
                <SocialIcon provider={option.provider} />
              </View>
              <Text className="ml-6 text-[17px] leading-[24px] font-poppins-medium text-text-primary">
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className={`mt-auto flex-row justify-center ${copy.socialTopSpacing}`}>
          <Text className="text-[16px] leading-[24px] font-poppins-regular text-[#7b849f]">
            {copy.footerText}{" "}
          </Text>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push(copy.footerHref)}
          >
            <Text className="text-[16px] leading-[24px] font-poppins-semibold text-lingua-deep-purple">
              {copy.footerAction}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <VerificationModal
        code={code}
        inputRef={codeInputRef}
        isVisible={isModalVisible}
        onChangeCode={handleCodeChange}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

type SocialProvider = (typeof socialOptions)[number]["provider"];

function SocialIcon({ provider }: { provider: SocialProvider }) {
  if (provider === "facebook") {
    return (
      <View style={styles.facebookLogo}>
        <Text style={styles.facebookLogoText}>f</Text>
      </View>
    );
  }

  if (provider === "apple") {
    return (
      <Image
        source={images.appleAuthLogo}
        style={styles.appleLogo}
        resizeMode="contain"
      />
    );
  }

  return (
    <Image
      source={images.googleAuthLogo}
      style={styles.googleLogo}
      resizeMode="contain"
    />
  );
}

type VerificationModalProps = {
  code: string;
  inputRef: RefObject<TextInput | null>;
  isVisible: boolean;
  onChangeCode: (value: string) => void;
  onClose: () => void;
};

function VerificationModal({
  code,
  inputRef,
  isVisible,
  onChangeCode,
  onClose,
}: VerificationModalProps) {
  const digits = Array.from(
    { length: CODE_LENGTH },
    (_, index) => code[index] ?? "",
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={isVisible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalKeyboardView}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text className="text-center text-[24px] leading-[30px] font-poppins-semibold text-text-primary">
              Check your email
            </Text>
            <Text className="mt-3 text-center text-[15px] leading-[23px] font-poppins-regular text-[#6f7896]">
              {"You've received an email. Enter the 6-digit verification code to continue."}
            </Text>

            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
            >
              <View className="mt-7 flex-row justify-between gap-2">
                {digits.map((digit, index) => (
                  <View
                    className="h-[54px] w-[45px] items-center justify-center rounded-[14px] border border-[#e6e9f2] bg-[#fafbff]"
                    key={index}
                  >
                    <Text className="text-[22px] leading-[28px] font-poppins-semibold text-text-primary">
                      {digit}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            <TextInput
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              onChangeText={onChangeCode}
              ref={inputRef}
              style={styles.hiddenCodeInput}
              textContentType="oneTimeCode"
              value={code}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 18,
    paddingHorizontal: 31,
    paddingTop: 14,
  },
  backButton: {
    alignSelf: "flex-start",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  input: {
    color: "#0D132B",
    fontFamily: "Poppins-Regular",
    fontSize: 17,
    lineHeight: 24,
    marginTop: 8,
    padding: 0,
  },
  socialIconSlot: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 54,
    width: 36,
  },
  googleLogo: {
    height: 34,
    width: 34,
  },
  facebookLogo: {
    alignItems: "center",
    backgroundColor: "#1877F2",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  facebookLogoText: {
    color: "#FFFFFF",
    fontFamily: "Poppins-Bold",
    fontSize: 31,
    lineHeight: 36,
    marginTop: 5,
  },
  appleLogo: {
    height: 31,
    width: 27,
  },
  modalBackdrop: {
    backgroundColor: "rgba(13, 19, 43, 0.38)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingBottom: 30,
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  modalKeyboardView: {
    flex: 1,
  },
  hiddenCodeInput: {
    height: 1,
    opacity: 0,
    position: "absolute",
    width: 1,
  },
});
