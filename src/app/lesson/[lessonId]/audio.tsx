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
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
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

const AI_TEACHER_USER_ID = "duo-ai-teacher";
const AGENT_OPENING_HEAD_START_MS = 900;
const AGENT_JOIN_TIMEOUT_MS = 10_000;

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
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [recognizedSpeech, setRecognizedSpeech] = useState<string | null>(null);
  const [practiceItemIndex, setPracticeItemIndex] = useState<number | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);
  const callSessionRef = useRef<StreamAudioCallSession | null>(null);
  const agentSessionRef = useRef<StreamAudioAgentSession | null>(null);
  const captionUnsubRef = useRef<(() => void) | null>(null);
  const captionClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStartingRef = useRef(false);
  const hasStartedRef = useRef(false);
  const mountedRef = useRef(true);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(
    async ({ resetState = true }: { resetState?: boolean } = {}) => {
      const agentSess = agentSessionRef.current;
      const callSess = callSessionRef.current;
      agentSessionRef.current = null;
      callSessionRef.current = null;

      // Tear down caption subscription and clear pending clear-timer
      captionUnsubRef.current?.();
      captionUnsubRef.current = null;
      if (captionClearRef.current) clearTimeout(captionClearRef.current);

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
        setPermissionMessage(null);
        setRecognizedSpeech(null);
        setPracticeItemIndex(null);
      }
    },
    [getToken],
  );

  // Latest-cleanup ref so the unmount effect runs exactly once (real unmount)
  // instead of re-firing whenever getToken/cleanup identity changes. A re-fire
  // would flip mountedRef to false and abort the in-flight call setup, leaving
  // the screen stuck on "creating".
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void cleanupRef.current({ resetState: false });
    };
  }, []);

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
      if (!mountedRef.current) return;
      callSessionRef.current = session;

      // Step 2 — Join the call via Stream SDK (requires native WebRTC modules).
      // Wrapped in try/catch so Expo Go doesn't crash here — the agent flow
      // below still runs and the agent session will appear in the server logs.
      setCallPhase("joining");
      await tryJoinCall(session, callRef, clientRef);
      if (!mountedRef.current) return;
      setCallPhase("active");

      // Start closed captions so the chat bubble shows what is actually being said.
      // Falls back gracefully if the feature isn't enabled on the Stream dashboard.
      const call = callRef.current;
      if (call) {
        // Keep learner audio out of the realtime model until Duo has started.
        await call.microphone.disable().catch(() => undefined);
        await call.startClosedCaptions().catch(() => undefined);
        captionUnsubRef.current = call.on("call.closed_caption", (event: any) => {
          if (!mountedRef.current) return;
          const cc = event?.closed_caption ?? event?.closedCaption;
          if (!cc?.text) return;
          const isAgent = (cc.speaker_id ?? cc.speakerId ?? "")
            .toLowerCase()
            .includes("duo");

          if (isAgent) {
            const spokenText = String(cc.text).toLocaleLowerCase();
            const nextPracticeIndex = lesson.vocabulary.findIndex((item) =>
              spokenText.includes(item.term.toLocaleLowerCase()),
            );
            if (nextPracticeIndex >= 0) {
              setPracticeItemIndex(nextPracticeIndex);
            }
            return;
          }

          setRecognizedSpeech(String(cc.text));
          // Keep the learner's latest STT result visible briefly, then return
          // to the stable practice prompt instead of showing stale dialogue.
          if (captionClearRef.current) clearTimeout(captionClearRef.current);
          captionClearRef.current = setTimeout(() => {
            if (mountedRef.current) setRecognizedSpeech(null);
          }, 8000);
        }) as unknown as () => void;
      }

      // Step 3 — Start Vision Agent (pure HTTP, works in Expo Go).
      // The agent reads lesson/language/goals/vocabulary/phrases from call.custom
      // and joins as "Duo AI Teacher" with admin publish rights.
      setAgentStatus("connecting");
      const agent = await startStreamAudioAgent({
        callId: session.callId,
        callType: session.callType,
        clerkToken: token,
      });
      if (!mountedRef.current) {
        // Component unmounted while agent was starting — stop it immediately
        // so it doesn't remain alive with no cleanup path.
        await stopStreamAudioAgent({
          callId: session.callId,
          clerkToken: token,
          sessionId: agent.sessionId,
        }).catch(() => undefined);
        return;
      }
      agentSessionRef.current = agent;

      // The session endpoint returns as soon as the background agent task starts,
      // not when it has actually joined the Stream call. Wait for Duo's participant
      // before opening the learner mic so the proactive introduction wins the first
      // turn instead of ambient audio or an accidental early utterance.
      if (call) {
        await waitForAgentParticipant(call, AGENT_JOIN_TIMEOUT_MS);
        await delay(AGENT_OPENING_HEAD_START_MS);
        if (!mountedRef.current) return;
        // Only flip to the "Listening" state when the mic is truly usable.
        // Swallowing the enable failure here would leave the UI claiming it's
        // listening while no audio reaches the agent.
        try {
          await call.microphone.enable();
          if (mountedRef.current) setIsMicEnabled(true);
        } catch {
          if (mountedRef.current) {
            setIsMicEnabled(false);
            setPermissionMessage(
              "Couldn't turn on your microphone. Check microphone permissions and retry.",
            );
          }
        }
      }

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

  // ── Interrupt ──────────────────────────────────────────────────────────────
  // Mic is always on — the agent's VAD stops it when the user speaks naturally.
  // Pressing this button forces an immediate interrupt: briefly cycles the mic
  // off/on so the agent's turn detection resets and it stops mid-sentence.
  const handleInterrupt = useCallback(async () => {
    // Only cycle the mic once it has been intentionally enabled — interrupting
    // while the agent is still connecting would turn the mic on prematurely.
    if (callPhase !== "active" || !isMicEnabled) return;
    const call = callRef.current;
    if (!call) return;
    setIsMicEnabled(false);
    await call.microphone.disable().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 100));
    // Re-enable can fail (permission revoked, device busy) — keep the mic shown
    // as off unless it actually came back on.
    try {
      await call.microphone.enable();
      if (mountedRef.current) setIsMicEnabled(true);
    } catch {
      if (mountedRef.current) setIsMicEnabled(false);
    }
  }, [callPhase, isMicEnabled]);

  const isConnecting =
    callPhase === "creating" ||
    callPhase === "joining" ||
    callPhase === "ending" ||
    (callPhase === "active" && agentStatus === "connecting");
  const micDisabled = callPhase !== "active" || !isMicEnabled;
  const practiceItem =
    practiceItemIndex === null ? null : lesson?.vocabulary[practiceItemIndex];

  // ── Lesson not found ───────────────────────────────────────────────────────
  if (!lesson) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <SafeHeader
          agentStatus="idle"
          callPhase="error"
          onEndCall={() => router.back()}
        />
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
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <SafeHeader
        agentStatus={agentStatus}
        callPhase={callPhase}
        lessonTitle={lesson.title}
        onEndCall={() => void handleEndCall()}
      />

      <View className="flex-1 bg-white px-4 pb-4">
        <View
          className="flex-1 overflow-hidden rounded-[26px] bg-[#F4F0FF]"
          style={styles.teacherCard}
        >
          <View className="flex-1 items-center justify-center pb-[76px] pt-3">
            <Image
              resizeMode="contain"
              source={images.mascotWelcome}
              style={styles.mascotImage}
            />
          </View>

          <View style={styles.practiceCard}>
            {isConnecting ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#5B3BF6" size="small" />
                <Text className="ml-3 flex-1 text-[13px] leading-[19px] font-poppins-medium text-[#69728A]">
                  {getPhaseLabel(callPhase, agentStatus)}
                </Text>
              </View>
            ) : callPhase === "error" ? (
              <View className="flex-row items-center">
                <View className="flex-1 pr-3">
                  <Text className="text-[14px] leading-[20px] font-poppins-semibold text-[#D14343]">
                    Connection failed
                  </Text>
                  <Text className="mt-1 text-[12px] leading-[17px] font-poppins-regular text-[#69728A]">
                    {errorMessage ?? "Could not connect to AI teacher."}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.82}
                  className="h-[36px] justify-center rounded-[11px] bg-[#D14343] px-4"
                  onPress={() => void handleStartLesson()}
                >
                  <Text className="text-[12px] font-poppins-semibold text-white">
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            ) : IS_EXPO_GO && agentStatus === "connected" ? (
              <>
                <Text className="text-[14px] leading-[20px] font-poppins-semibold text-[#1B2340]">
                  Agent connected - no live audio
                </Text>
                <Text className="mt-1 text-[12px] leading-[17px] font-poppins-regular text-[#69728A]">
                  Use the Android development build for the full lesson.
                </Text>
              </>
            ) : recognizedSpeech ? (
              <>
                <Text className="text-[11px] leading-[16px] font-poppins-semibold uppercase tracking-[1px] text-[#7D6BE8]">
                  I heard
                </Text>
                <Text
                  className="mt-1 text-[18px] leading-[25px] font-poppins-semibold text-[#1B2340]"
                  numberOfLines={2}
                  selectable
                >
                  {`"${recognizedSpeech}"`}
                </Text>
                <Text className="mt-1 text-[12px] leading-[17px] font-poppins-regular text-[#69728A]">
                  Target: {practiceItem?.term ?? "Wait for Duo's prompt"}
                  {practiceItem?.pronunciation
                    ? ` / ${practiceItem.pronunciation}`
                    : ""}
                </Text>
                <Text className="mt-1 text-[10px] leading-[14px] font-poppins-regular text-[#9AA1B3]">
                  Transcript only. Duo evaluates pronunciation from your audio.
                </Text>
              </>
            ) : (
              <>
                <Text className="text-[11px] leading-[16px] font-poppins-semibold uppercase tracking-[1px] text-[#7D6BE8]">
                  Say this
                </Text>
                <Text
                  className="mt-1 text-[20px] leading-[27px] font-poppins-bold text-[#1B2340]"
                  selectable
                >
                  {practiceItem?.term ?? "Listen to Duo"}
                </Text>
                <Text className="mt-1 text-[12px] leading-[17px] font-poppins-regular text-[#69728A]">
                  {practiceItem
                    ? `${practiceItem.translation} / ${practiceItem.pronunciation}`
                    : "Your teacher will give you the first phrase."}
                </Text>
              </>
            )}
          </View>
        </View>

        {permissionMessage ? (
          <View style={styles.permissionToast}>
            <Text className="text-center text-[12px] leading-[17px] font-poppins-medium text-[#D14343]">
              {permissionMessage}
            </Text>
          </View>
        ) : null}

        <View className="items-center py-5">
          <MicInterruptButton
            disabled={micDisabled}
            isActive={isMicEnabled}
            onPress={() => void handleInterrupt()}
          />
          <Text className="mt-3 text-[13px] leading-[18px] font-poppins-medium text-[#646B7E]">
            {isMicEnabled ? "Listening - speak naturally" : "Microphone is waiting"}
          </Text>
        </View>

        <View
          className="flex-row items-center rounded-[20px] border border-[#ECECF2] bg-white px-3 py-4"
          style={styles.statsCard}
        >
          <StatItem
            color="#24C96B"
            label="Speaking"
            value={isMicEnabled ? "Listening" : "Waiting"}
          />
          <View className="h-[34px] w-px bg-[#E9E9F0]" />
          <StatItem color="#6484E8" label="Pronunciation" value="AI feedback" />
          <View className="h-[34px] w-px bg-[#E9E9F0]" />
          <StatItem color="#6E55C9" label="Grammar" value="Live" />
        </View>
      </View>
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function SafeHeader({
  agentStatus,
  callPhase,
  lessonTitle,
  onEndCall,
}: {
  agentStatus: AgentStatus;
  callPhase: CallPhase;
  lessonTitle?: string;
  onEndCall: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { color, label } = headerStatus(callPhase, agentStatus);

  return (
    <View className="bg-white" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <View className="flex-row items-center px-3 pb-1 pt-1">
        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center"
          onPress={onEndCall}
        >
          <Ionicons color="#1B2340" name="chevron-back" size={25} />
        </TouchableOpacity>
        <View className="flex-1 items-center px-2">
          <Text className="text-center text-[16px] leading-[22px] font-poppins-semibold text-[#1B2340]">
            AI Teacher
          </Text>
          {lessonTitle ? (
            <Text
              className="mt-0.5 text-center text-[10px] leading-[14px] font-poppins-medium text-[#8B94A8]"
              numberOfLines={1}
            >
              {lessonTitle}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityLabel="End call"
          accessibilityRole="button"
          className="mt-2 h-12 w-12 items-center justify-center rounded-full bg-[#E9414B]"
          onPress={onEndCall}
          style={styles.endCallButton}
        >
          <Ionicons color="#FFFFFF" name="call" size={22} />
        </TouchableOpacity>
      </View>
      <View className="flex-row items-center px-3 pb-3">
        <View
          className="mr-2 h-[7px] w-[7px] rounded-full"
          style={{ backgroundColor: color }}
        />
        <Text
          className="text-[12px] leading-[17px] font-poppins-medium"
          style={{ color }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function MicInterruptButton({
  disabled,
  isActive,
  onPress,
}: {
  disabled: boolean;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      accessibilityLabel={isActive ? "Tap to interrupt AI" : "Microphone"}
      accessibilityRole="button"
      className={disabled ? "opacity-40" : ""}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        className="h-[72px] w-[72px] items-center justify-center rounded-full bg-white"
        style={isActive ? styles.micActiveGlow : styles.micIdleShadow}
      >
        <Ionicons
          color={isActive ? "#17223C" : "#9AA1B3"}
          name={isActive ? "mic-outline" : "mic-off-outline"}
          size={31}
        />
      </View>
    </TouchableOpacity>
  );
}

function StatItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 items-center px-1">
      <Text className="text-[10px] leading-[14px] font-poppins-regular text-[#8B94A8]">
        {label}
      </Text>
      <Text
        className="mt-1 text-center text-[11px] leading-[15px] font-poppins-semibold"
        style={{ color }}
      >
        {value}
      </Text>
    </View>
  );
}

// SDK join (skipped in Expo Go, works in dev build / standalone)
const IS_EXPO_GO = Constants.appOwnership === "expo";

async function tryJoinCall(
  session: StreamAudioCallSession,
  callRef: React.MutableRefObject<Call | null>,
  clientRef: React.MutableRefObject<StreamVideoClient | null>,
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

    // Pre-request mic permission so the auto-enable in handleStartLesson is instant.
    await requestPermission("mic").catch(() => undefined);
  } catch {
    // Join failed for an unexpected reason — agent call still continues above.
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForAgentParticipant(
  call: Call,
  timeoutMs: number,
): Promise<void> {
  if (
    call.state.participants.some(
      (participant) => participant.userId === AI_TEACHER_USER_ID,
    )
  ) {
    return;
  }

  await new Promise<void>((resolve) => {
    let unsubscribe: (() => void) | undefined;
    const finish = () => {
      clearTimeout(timeout);
      unsubscribe?.();
      resolve();
    };
    const timeout = setTimeout(finish, timeoutMs);

    unsubscribe = call.on("call.session_participant_joined", (event) => {
      if (event.participant.user.id === AI_TEACHER_USER_ID) {
        finish();
      }
    });
  });
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

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
  endCallButton: {
    elevation: 4,
    shadowColor: "#B7232C",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    transform: [{ rotate: "135deg" }],
  },
  mascotImage: {
    height: 245,
    width: 220,
  },
  micActiveGlow: {
    elevation: 9,
    shadowColor: "#B9A9FF",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  micIdleShadow: {
    elevation: 4,
    shadowColor: "#A9AFC0",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  permissionToast: {
    alignItems: "center",
    backgroundColor: "#FFF0F0",
    borderRadius: 13,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  practiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    bottom: 12,
    elevation: 5,
    left: 12,
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: "absolute",
    right: 12,
    shadowColor: "#62559A",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 11,
  },
  screen: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  statsCard: {
    elevation: 3,
    shadowColor: "#9398A8",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  teacherCard: {
    elevation: 2,
    shadowColor: "#B8AAE8",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
});
