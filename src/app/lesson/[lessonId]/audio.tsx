// Stream SDK types are imported as type-only — no runtime import, no Expo Go crash.
// The SDK itself is loaded lazily inside tryJoinCall() and only when native modules
// are available (dev build / standalone). Expo Go skips it cleanly.
import type { Call, StreamVideoClient } from "@stream-io/video-react-native-sdk";
import Constants from "expo-constants";
import { useAuth } from "@clerk/expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { lessonsById } from "@/data/lessons";
import {
  createStreamAudioCall,
  startStreamAudioAgent,
  stopStreamAudioAgent,
  type StreamAudioAgentSession,
  type StreamAudioCallSession,
} from "@/lib/stream-audio";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallPhase = "idle" | "creating" | "joining" | "active" | "ending" | "error";
type AgentStatus = "idle" | "connecting" | "connected" | "failed";

// Constructor shape we need at runtime (matches StreamVideoClient constructor)
type StreamVideoClientCtor = new (opts: {
  apiKey: string;
  token: string;
  user: { id: string; image?: string; name: string };
}) => StreamVideoClient;

const BAR_MAX_WIDTH = 470;
const BAR_HORIZONTAL_MARGIN = 12;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AudioLessonScreen() {
  const params = useLocalSearchParams<{ lessonId?: string | string[] }>();
  const lessonId = Array.isArray(params.lessonId)
    ? params.lessonId[0]
    : params.lessonId;
  const lesson = lessonId ? lessonsById[lessonId] : null;
  const { getToken } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [areSubtitlesEnabled, setAreSubtitlesEnabled] = useState(true);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);
  const callSessionRef = useRef<StreamAudioCallSession | null>(null);
  const agentSessionRef = useRef<StreamAudioAgentSession | null>(null);
  const isStartingRef = useRef(false);
  const hasStartedRef = useRef(false);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(
    async ({ resetState = true }: { resetState?: boolean } = {}) => {
      const agentSess = agentSessionRef.current;
      const callSess = callSessionRef.current;
      agentSessionRef.current = null;
      callSessionRef.current = null;

      if (agentSess && callSess) {
        const token = await getToken().catch(() => null);
        if (token) {
          await stopStreamAudioAgent({
            callId: callSess.callId,
            clerkToken: token,
            sessionId: agentSess.sessionId,
          }).catch(() => undefined);
        }
      }

      const call = callRef.current;
      const client = clientRef.current;
      callRef.current = null;
      clientRef.current = null;

      await call?.leave().catch(() => undefined);
      await client?.disconnectUser().catch(() => undefined);

      if (resetState) {
        setCallPhase("idle");
        setAgentStatus("idle");
        setIsMicEnabled(false);
        setErrorMessage(null);
      }
    },
    [getToken],
  );

  useEffect(() => {
    return () => {
      void cleanup({ resetState: false });
    };
  }, [cleanup]);

  // ── Start lesson ───────────────────────────────────────────────────────────
  const handleStartLesson = useCallback(async () => {
    if (!lesson || isStartingRef.current) return;
    isStartingRef.current = true;
    setCallPhase("creating");
    setAgentStatus("idle");
    setErrorMessage(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in.");

      // Step 1 — Create Stream call (pure HTTP, works in Expo Go).
      // Server packs all lesson context into call.custom for the agent to read.
      const session = await createStreamAudioCall({
        clerkToken: token,
        languageId: lesson.languageId,
        lessonId: lesson.id,
      });
      callSessionRef.current = session;

      // Step 2 — Join the call via Stream SDK (requires native WebRTC modules).
      // Wrapped in try/catch so Expo Go doesn't crash here — the agent flow
      // below still runs and the agent session will appear in the server logs.
      setCallPhase("joining");
      await tryJoinCall(session, callRef, clientRef, setIsMicEnabled);
      setCallPhase("active");

      // Step 3 — Start Vision Agent (pure HTTP, works in Expo Go).
      // The agent reads lesson/language/goals/vocabulary/phrases from call.custom
      // and joins as "Duo AI Teacher" with admin publish rights.
      setAgentStatus("connecting");
      const agent = await startStreamAudioAgent({
        callId: session.callId,
        callType: session.callType,
        clerkToken: token,
      });
      agentSessionRef.current = agent;
      setAgentStatus("connected");
    } catch (error) {
      await cleanup({ resetState: false });
      setCallPhase("error");
      setAgentStatus("failed");
      setErrorMessage(getErrorMessage(error));
    } finally {
      isStartingRef.current = false;
    }
  }, [lesson, getToken, cleanup]);

  // Auto-start once on mount
  useEffect(() => {
    if (hasStartedRef.current || !lesson) return;
    hasStartedRef.current = true;
    void handleStartLesson();
  }, [lesson, handleStartLesson]);

  // ── End call ───────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(async () => {
    setCallPhase("ending");
    await cleanup({ resetState: false });
    router.back();
  }, [cleanup]);

  // ── Mic toggle ─────────────────────────────────────────────────────────────
  const handleToggleMic = useCallback(async () => {
    if (callPhase !== "active") return;
    // Optional chaining: if the Stream SDK isn't available (Expo Go) the state
    // still updates so the button looks correct; audio just won't stream.
    const call = callRef.current;
    if (isMicEnabled) {
      await call?.microphone.disable().catch(() => undefined);
      setIsMicEnabled(false);
    } else {
      const granted = await requestPermission("mic");
      if (granted) {
        await call?.microphone.enable().catch(() => undefined);
        setIsMicEnabled(true);
      } else {
        setPermissionMessage("Microphone permission was denied.");
      }
    }
  }, [callPhase, isMicEnabled]);

  // ── Camera toggle ──────────────────────────────────────────────────────────
  const handleToggleCamera = useCallback(async () => {
    setPermissionMessage(null);
    if (isCameraEnabled) {
      setIsCameraEnabled(false);
      return;
    }
    const granted = await requestPermission("camera");
    if (granted) {
      setIsCameraEnabled(true);
    } else {
      setPermissionMessage("Camera permission was denied.");
    }
  }, [isCameraEnabled]);

  const isConnecting =
    callPhase === "creating" ||
    callPhase === "joining" ||
    callPhase === "ending" ||
    (callPhase === "active" && agentStatus === "connecting");
  const micDisabled = callPhase !== "active";

  // ── Lesson not found ───────────────────────────────────────────────────────
  if (!lesson) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <SafeHeader agentStatus="idle" callPhase="error" />
        <View
          className="flex-1 items-center justify-center px-8"
          style={{ backgroundColor: "#F0EDFF" }}
        >
          <Text className="text-center text-[18px] leading-[25px] font-poppins-semibold text-text-primary">
            Lesson not found
          </Text>
          <TouchableOpacity
            activeOpacity={0.82}
            className="mt-4 h-[44px] items-center justify-center rounded-[14px] bg-lingua-deep-purple px-6"
            onPress={() => router.back()}
          >
            <Text className="text-[14px] font-poppins-semibold text-white">
              Go back
            </Text>
          </TouchableOpacity>
        </View>
        <AudioTabBar />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <SafeHeader agentStatus={agentStatus} callPhase={callPhase} />

      {/* ── Main content ──────────────────────────────────────────────── */}
      <View className="flex-1 bg-[#F0EDFF]" style={{ position: "relative" }}>
        <View
          className="absolute inset-0 items-center justify-end"
          style={{ paddingBottom: 90 }}
        >
          <Image
            resizeMode="contain"
            source={images.mascotWelcome}
            style={styles.mascotImage}
          />
        </View>

        {/* User PiP */}
        <View style={styles.pipContainer}>
          <View className="flex-1 items-center justify-center bg-[#EEE8FF]">
            <Text className="text-[24px] font-poppins-bold text-lingua-deep-purple">
              N
            </Text>
            <Text className="mt-1 text-[10px] font-poppins-medium text-[#8790AA]">
              {isCameraEnabled ? "Camera on" : "Camera off"}
            </Text>
          </View>
        </View>

        {/* Permission denied toast */}
        {permissionMessage ? (
          <View style={styles.permissionToast}>
            <Text className="text-center text-[13px] leading-[18px] font-poppins-medium text-[#D14343]">
              {permissionMessage}
            </Text>
          </View>
        ) : null}

        {/* Chat bubble — reflects current call/agent state */}
        <View style={styles.chatBubble}>
          {isConnecting ? (
            <>
              <ActivityIndicator color="#5B3BF6" size="small" />
              <Text className="ml-3 flex-1 text-[14px] leading-[20px] font-poppins-medium text-[#5E6785]">
                {getPhaseLabel(callPhase, agentStatus)}
              </Text>
            </>
          ) : callPhase === "error" ? (
            <>
              <View className="flex-1 pr-2">
                <Text className="text-[14px] leading-[20px] font-poppins-semibold text-[#D14343]">
                  Connection failed
                </Text>
                <Text
                  className="mt-[2px] text-[12px] leading-[17px] font-poppins-regular text-[#5E6785]"
                  numberOfLines={2}
                >
                  {errorMessage ?? "Could not connect to AI teacher."}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.82}
                className="h-[36px] items-center justify-center rounded-[10px] bg-[#D14343] px-3"
                onPress={() => void handleStartLesson()}
              >
                <Text className="text-[12px] font-poppins-semibold text-white">
                  Retry
                </Text>
              </TouchableOpacity>
            </>
          ) : IS_EXPO_GO && agentStatus === "connected" ? (
            <>
              <View className="flex-1 pr-2">
                <Text className="text-[14px] leading-[20px] font-poppins-semibold text-[#1B2340]">
                  Agent connected · no audio
                </Text>
                <Text className="mt-[2px] text-[12px] leading-[17px] font-poppins-regular text-[#5E6785]">
                  Run{" "}
                  <Text className="font-poppins-semibold text-[#5B3BF6]">
                    npx expo run:android
                  </Text>{" "}
                  for live audio
                </Text>
              </View>
              <View className="h-[36px] w-[36px] items-center justify-center rounded-full bg-[#FFF4E0]">
                <Ionicons color="#EBB733" name="information-circle" size={20} />
              </View>
            </>
          ) : (
            <>
              <View className="flex-1 pr-2">
                <Text className="text-[16px] leading-[22px] font-poppins-bold text-[#1B2340]">
                  {agentStatus === "connected" ? "¡Muy bien!" : "AI Teacher"}
                </Text>
                <Text className="mt-[2px] text-[13px] leading-[19px] font-poppins-regular text-[#5E6785]">
                  {agentStatus === "connected"
                    ? "That was great! 👏"
                    : "Your teacher is ready to speak..."}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                className="h-[36px] w-[36px] items-center justify-center rounded-full bg-[#F4F1FF]"
              >
                <Ionicons color="#5B3BF6" name="volume-high" size={17} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <View style={styles.controlsSection}>
        <View className="flex-row justify-around px-2 pt-5">
          <CallControl
            icon={isCameraEnabled ? "videocam" : "videocam-off"}
            isActive={isCameraEnabled}
            label="Camera"
            onPress={handleToggleCamera}
          />
          <CallControl
            disabled={micDisabled}
            icon={isMicEnabled ? "mic" : "mic-off"}
            isActive={isMicEnabled}
            label="Mic"
            onPress={handleToggleMic}
          />
          <CallControl
            icon="language"
            isActive={areSubtitlesEnabled}
            label="Subtitles"
            onPress={() => setAreSubtitlesEnabled((v) => !v)}
          />
          <CallControl
            icon="call"
            isEndCall
            label="End Call"
            onPress={handleEndCall}
          />
        </View>

        <View className="mt-4 flex-row justify-around px-6 pb-3">
          <StatItem label="Speaking" value="Excellent" />
          <AgentStatItem status={agentStatus} />
          <StatItem label="Grammar" value="Good" />
        </View>
      </View>

      <AudioTabBar />
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function SafeHeader({
  agentStatus,
  callPhase,
}: {
  agentStatus: AgentStatus;
  callPhase: CallPhase;
}) {
  const insets = useSafeAreaInsets();
  const { color, label } = headerStatus(callPhase, agentStatus);

  return (
    <View className="bg-white" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <View className="flex-row items-center px-4 pb-2 pt-1">
        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons color="#1B2340" name="chevron-back" size={26} />
        </TouchableOpacity>
        <Text className="ml-1 flex-1 text-[20px] leading-[26px] font-poppins-bold text-[#1B2340]">
          AI Teacher
        </Text>
        <View className="flex-row items-center">
          <Ionicons color="#1B2340" name="videocam-outline" size={22} />
          <Text className="ml-[3px] mr-4 text-[13px] font-poppins-semibold text-[#1B2340]">
            12
          </Text>
          <Ionicons color="#1B2340" name="notifications-outline" size={22} />
        </View>
      </View>
      <View className="flex-row items-center px-5 pb-2">
        <View
          className="mr-2 h-[8px] w-[8px] rounded-full"
          style={{ backgroundColor: color }}
        />
        <Text
          className="text-[13px] leading-[18px] font-poppins-medium"
          style={{ color }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────

type CallControlProps = {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  isActive?: boolean;
  isEndCall?: boolean;
  label: string;
  onPress: () => void;
};

function CallControl({
  disabled = false,
  icon,
  isActive = true,
  isEndCall = false,
  label,
  onPress,
}: CallControlProps) {
  const circleClass = isEndCall
    ? "bg-[#FF4045]"
    : isActive
      ? "bg-white"
      : "bg-[#1A2545]";
  const iconColor = isEndCall
    ? "#FFFFFF"
    : disabled
      ? "#4A5268"
      : isActive
        ? "#091A4F"
        : "#6A78A0";

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      accessibilityLabel={label}
      accessibilityRole="button"
      className={`flex-1 items-center ${disabled ? "opacity-40" : ""}`}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        className={`h-[64px] w-[64px] items-center justify-center rounded-full ${circleClass}`}
        style={isActive && !isEndCall ? styles.callButtonShadow : undefined}
      >
        <Ionicons color={iconColor} name={icon} size={28} />
      </View>
      <Text className="mt-2 text-center text-[12px] leading-[16px] font-poppins-medium text-white">
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text className="text-[11px] leading-[15px] font-poppins-regular text-[#8B94AD]">
        {label}
      </Text>
      <Text className="mt-[2px] text-[13px] leading-[18px] font-poppins-semibold text-[#25C636]">
        {value}
      </Text>
    </View>
  );
}

const AGENT_STATUS_CONFIG: Record<AgentStatus, { color: string; label: string }> =
  {
    connected: { color: "#25C636", label: "Connected" },
    connecting: { color: "#EBB733", label: "Connecting" },
    failed: { color: "#D14343", label: "Failed" },
    idle: { color: "#8B94AD", label: "Idle" },
  };

function AgentStatItem({ status }: { status: AgentStatus }) {
  const { color, label } = AGENT_STATUS_CONFIG[status];
  return (
    <View className="items-center">
      <Text className="text-[11px] leading-[15px] font-poppins-regular text-[#8B94AD]">
        AI Teacher
      </Text>
      <Text
        className="mt-[2px] text-[13px] leading-[18px] font-poppins-semibold"
        style={{ color }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function AudioTabBar() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barWidth = Math.min(width - BAR_HORIZONTAL_MARGIN * 2, BAR_MAX_WIDTH);

  const tabs: Array<{
    activeIcon: ImageSourcePropType;
    icon: ImageSourcePropType;
    isActive?: boolean;
    label: string;
    onPress: () => void;
  }> = [
    {
      activeIcon: images.tabHomeActive,
      icon: images.tabHome,
      label: "Home",
      onPress: () => router.replace("/"),
    },
    {
      activeIcon: images.tabLearnActive,
      icon: images.tabLearn,
      isActive: true,
      label: "Learn",
      onPress: () => router.back(),
    },
    {
      activeIcon: images.tabAiTeacherActive,
      icon: images.tabAiTeacher,
      label: "AI Teacher",
      onPress: () => router.replace("/ai-teacher"),
    },
    {
      activeIcon: images.tabChatActive,
      icon: images.tabChat,
      label: "Chat",
      onPress: () => router.replace("/chat"),
    },
    {
      activeIcon: images.tabProfileActive,
      icon: images.tabProfile,
      label: "Profile",
      onPress: () => router.replace("/profile"),
    },
  ];

  return (
    <View
      className="items-center bg-white px-3 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      <View
        className="h-[86px] flex-row items-center rounded-[30px] bg-white px-2"
        style={[styles.tabBarShadow, { width: barWidth }]}
      >
        {tabs.map((tab) => (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="button"
            accessibilityState={tab.isActive ? { selected: true } : {}}
            key={tab.label}
            onPress={tab.onPress}
            style={({ pressed }) => [
              styles.tabItem,
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Image
              resizeMode="contain"
              source={tab.isActive ? tab.activeIcon : tab.icon}
              style={{ height: 27, width: 27 }}
            />
            <Text
              className={`mt-[5px] w-full text-center text-[11px] leading-4 font-poppins-semibold ${
                tab.isActive ? "text-[#6E48F6]" : "text-[#7E849E]"
              }`}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── SDK join (skipped in Expo Go, works in dev build / standalone) ──────────

// True when running inside Expo Go (appOwnership === 'expo').
// In Expo Go, WebRTC native modules are not bundled, so we skip the SDK join
// entirely rather than letting Metro throw a red-screen error.
const IS_EXPO_GO = Constants.appOwnership === "expo";

async function tryJoinCall(
  session: StreamAudioCallSession,
  callRef: React.MutableRefObject<Call | null>,
  clientRef: React.MutableRefObject<StreamVideoClient | null>,
  setIsMicEnabled: (v: boolean) => void,
): Promise<void> {
  if (IS_EXPO_GO) {
    // Native WebRTC is not available in Expo Go.
    // The Stream call is still created and live — the Vision Agent joins it.
    // To hear the agent, run with `npx expo run:android` (dev build).
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require("@stream-io/video-react-native-sdk") as {
      StreamVideoClient: StreamVideoClientCtor;
    };

    const client = new sdk.StreamVideoClient({
      apiKey: session.apiKey,
      token: session.token,
      user: {
        id: session.user.id,
        image: session.user.image,
        name: session.user.name,
      },
    });
    const call = client.call(session.callType, session.callId);

    clientRef.current = client;
    callRef.current = call;

    await call.join();

    const micGranted = await requestPermission("mic");
    if (micGranted) {
      await call.microphone.enable();
      setIsMicEnabled(true);
    }
  } catch {
    // Join failed for an unexpected reason — agent call still continues above.
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headerStatus(
  callPhase: CallPhase,
  agentStatus: AgentStatus,
): { color: string; label: string } {
  if (callPhase === "error" || agentStatus === "failed") {
    return { color: "#D14343", label: "Connection failed" };
  }
  if (callPhase === "active" && agentStatus === "connected") {
    return { color: "#25C636", label: "Online" };
  }
  if (callPhase === "active" && agentStatus === "connecting") {
    return { color: "#EBB733", label: "Teacher connecting..." };
  }
  if (callPhase === "creating") {
    return { color: "#EBB733", label: "Setting up call..." };
  }
  if (callPhase === "joining") {
    return { color: "#EBB733", label: "Joining call..." };
  }
  if (callPhase === "ending") {
    return { color: "#8B94AD", label: "Ending call..." };
  }
  return { color: "#8B94AD", label: "Connecting..." };
}

function getPhaseLabel(callPhase: CallPhase, agentStatus: AgentStatus): string {
  if (callPhase === "creating") return "Creating your audio lesson...";
  if (callPhase === "joining") return "Joining the call...";
  if (callPhase === "ending") return "Ending the call...";
  if (agentStatus === "connecting") return "Connecting your AI teacher...";
  return "Please wait...";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

async function requestPermission(type: "camera" | "mic"): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const permission =
    type === "camera"
      ? PermissionsAndroid.PERMISSIONS.CAMERA
      : PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;

  const result = await PermissionsAndroid.request(permission, {
    title: type === "camera" ? "Camera permission" : "Microphone permission",
    message:
      type === "camera"
        ? "This app needs access to your camera for video calls."
        : "This app needs access to your microphone for audio lessons.",
    buttonNegative: "Deny",
    buttonPositive: "Allow",
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  callButtonShadow: {
    elevation: 4,
    shadowColor: "#FFFFFF",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  chatBubble: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    bottom: 14,
    elevation: 6,
    flexDirection: "row",
    left: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "absolute",
    right: 14,
    shadowColor: "#1B2340",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
  },
  controlsSection: {
    backgroundColor: "#0C1230",
    paddingBottom: 6,
  },
  mascotImage: {
    height: 280,
    width: 240,
  },
  permissionToast: {
    alignItems: "center",
    backgroundColor: "#FFF0F0",
    borderRadius: 14,
    bottom: 100,
    left: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "absolute",
    right: 14,
    zIndex: 10,
  },
  pipContainer: {
    borderColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 3,
    elevation: 6,
    height: 108,
    overflow: "hidden",
    position: "absolute",
    right: 14,
    shadowColor: "#0D132B",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    top: 12,
    width: 80,
  },
  screen: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  tabBarShadow: {
    elevation: 12,
    shadowColor: "#0D132B",
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
    height: 76,
    justifyContent: "center",
    minWidth: 0,
    paddingTop: 6,
    zIndex: 1,
  },
});
