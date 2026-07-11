// Stream SDK types are imported as type-only — no runtime import, no Expo Go crash.
// The SDK itself is loaded lazily inside tryJoinCall() and only when native modules
// are available (dev build / standalone). Expo Go skips it cleanly.
import { useAuth } from "@clerk/expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Call, StreamVideoClient } from "@stream-io/video-react-native-sdk";
import Constants from "expo-constants";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { usePostHog } from "posthog-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { units } from "@/data/units";
import {
  trackLessonAbandoned,
  trackLessonCompleted,
  trackLessonStarted,
} from "@/lib/analytics";
import {
  createStreamAudioCall,
  startStreamAudioAgent,
  stopStreamAudioAgent,
  type StreamAudioAgentSession,
  type StreamAudioCallSession,
} from "@/lib/stream-audio";
import { makeReviewId } from "@/lib/learning-review";
import { useProgressStore } from "@/store/progress-store";
import type { Lesson } from "@/types/learning";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClosedCaptionEventData = {
  text?: string;
  speaker_id?: string;
  speakerId?: string;
};

type ClosedCaptionEvent = {
  closed_caption?: ClosedCaptionEventData;
  closedCaption?: ClosedCaptionEventData;
};

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
// Treat caption segments arriving within this window as one spoken turn.
const LEARNER_TURN_DEBOUNCE_MS = 2500;
// Engagement threshold for the "wrap it up" hint shown in the UI. Actual XP
// completion is gated separately, by Duo's own wrap-up signal (see
// lessonWrappedUpRef) — not by turn count, which is too easy to game.
const MIN_TURNS_FOR_XP = 3;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AudioLessonScreen() {
  const params = useLocalSearchParams<{ lessonId?: string | string[] }>();
  const lessonId = Array.isArray(params.lessonId)
    ? params.lessonId[0]
    : params.lessonId;
  const lesson = lessonId ? lessonsById[lessonId] : null;
  const { getToken } = useAuth();
  const posthog = usePostHog();
  const completeLesson = useProgressStore((state) => state.completeLesson);
  const recordActivity = useProgressStore((state) => state.recordActivity);
  const recordReviewResult = useProgressStore((state) => state.recordReviewResult);

  // ── State ──────────────────────────────────────────────────────────────────
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [recognizedSpeech, setRecognizedSpeech] = useState<string | null>(null);
  // The number of times the learner has spoken. This is the single source of
  // truth for progress: it drives the practice target, the "words said" counter,
  // and lesson completion. Captions from the learner are reliable; matching the
  // agent's speech against vocabulary keywords was not, so we no longer use it.
  const [spokenTurns, setSpokenTurns] = useState(0);
  // Index into the rotating "try saying" hints shown while the learner listens.
  const [hintIndex, setHintIndex] = useState(0);

  // Award XP exactly once per session.
  const hasAwardedXpRef = useRef(false);
  // One spoken utterance can arrive as several caption segments; only count a
  // new turn after a short gap so progress doesn't jump several words at once.
  const lastLearnerTurnRef = useRef(0);
  // Whether the agent ever reached "connected". The end-of-call XP fallback uses
  // this so a learner who actually did the lesson always gets their reward.
  const hasConnectedRef = useRef(false);
  // True once Duo's own captions signal the lesson wrap-up (both prompt variants
  // are instructed to say "hang up" in that closing line). This — not a generic
  // turns/time heuristic — is what actually gates XP and skipping the "leave
  // early?" confirmation, since neither turn count nor elapsed time tells us
  // whether the learner really finished.
  const lessonWrappedUpRef = useRef(false);
  // Everything Duo has said this session, used only to pull the specific
  // chunks it names as needing more practice in the wrap-up (see
  // extractStruggledChunkIds). Cleared implicitly on unmount with the rest of
  // this screen's refs.
  const agentTranscriptRef = useRef("");
  // Guards against double-recording if the wrap-up caption fires more than once.
  const struggledChunksAppliedRef = useRef(false);

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
  // Abort in-flight API requests on unmount to prevent memory leaks
  const abortControllerRef = useRef(new AbortController());

  // ── Analytics refs ───────────────────────────────────────────────────────
  // Start time is captured on mount so the abandonment duration stays accurate
  // no matter how often the screen re-renders. lastQuestionIndexRef tracks the
  // latest practice item so the unmount cleanup reads a fresh value (not a
  // stale closure). lessonCompletedRef guards against firing lesson_abandoned
  // once a lesson_completed flow exists.
  const lessonStartTimeRef = useRef(0);
  const lastQuestionIndexRef = useRef(-1);
  const lessonStartedRef = useRef(false);
  const lessonCompletedRef = useRef(false);

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
        setSpokenTurns(0);
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
      // Cancel any in-flight API requests to prevent memory leaks
      abortControllerRef.current.abort();
      void cleanupRef.current({ resetState: false });
    };
  }, []);

  // Keep the latest practice item index in a ref for the abandonment payload.
  useEffect(() => {
    if (!lesson || spokenTurns <= 0) return;
    lastQuestionIndexRef.current = Math.min(
      spokenTurns,
      lesson.vocabulary.length - 1,
    );
  }, [lesson, spokenTurns]);

  // lesson_started on mount, lesson_abandoned on unmount (unless completed).
  // `lesson` is derived from the route param and stays referentially stable for
  // the life of this screen, so a mount-once effect is safe here.
  useEffect(() => {
    if (!lesson) return;
    lessonStartTimeRef.current = Date.now();
    lessonStartedRef.current = true;
    trackLessonStarted(posthog, {
      lesson_id: lesson.id,
      language: lesson.languageId,
      lesson_number: getLessonNumber(lesson),
    });

    return () => {
      // Intentionally read the refs' *latest* values at unmount time so we know
      // whether the lesson was completed before the learner left.
      if (!lessonStartedRef.current || lessonCompletedRef.current) return;
      trackLessonAbandoned(posthog, {
        lesson_id: lesson.id,
        time_into_lesson_seconds: Math.round(
          (Date.now() - lessonStartTimeRef.current) / 1000,
        ),
        last_question_index: lastQuestionIndexRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start lesson ───────────────────────────────────────────────────────────
  const handleStartLesson = useCallback(async () => {
    if (!lesson || isStartingRef.current) return;
    isStartingRef.current = true;
    hasAwardedXpRef.current = false;
    lastLearnerTurnRef.current = 0;
    hasConnectedRef.current = false;
    lessonWrappedUpRef.current = false;
    agentTranscriptRef.current = "";
    struggledChunksAppliedRef.current = false;
    setCallPhase("creating");
    setAgentStatus("idle");
    setErrorMessage(null);
    setSpokenTurns(0);

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
        captionUnsubRef.current = call.on("call.closed_caption", (event: ClosedCaptionEvent) => {
          if (!mountedRef.current) return;
          const cc = event?.closed_caption ?? event?.closedCaption;
          if (!cc?.text) return;
          const isAgent = (cc.speaker_id ?? cc.speakerId ?? "")
            .toLowerCase()
            .includes("duo");

          // We don't drive the practice target from Duo's captions (keyword
          // matching was unreliable — it stuck on the first word). We do still
          // watch for the wrap-up cue so we know the lesson genuinely finished,
          // and pull out any chunks Duo names as still needing practice.
          if (isAgent) {
            agentTranscriptRef.current += ` ${String(cc.text)}`;
            const lowerText = String(cc.text).toLowerCase();

            if (lowerText.includes("hang up")) {
              lessonWrappedUpRef.current = true;
            }

            if (!struggledChunksAppliedRef.current && lesson) {
              const struggledIds = extractStruggledChunkIds(agentTranscriptRef.current, lesson);
              if (struggledIds.length > 0) {
                struggledChunksAppliedRef.current = true;
                for (const reviewId of struggledIds) {
                  recordReviewResult(reviewId, false);
                }
              }
            }
            return;
          }

          setRecognizedSpeech(String(cc.text));

          // Count how many times the learner has spoken (a rough engagement
          // signal, no longer a completion target). One utterance can fire
          // several caption segments, so debounce: only count after a short gap.
          const now = Date.now();
          if (now - lastLearnerTurnRef.current > LEARNER_TURN_DEBOUNCE_MS) {
            lastLearnerTurnRef.current = now;
            setSpokenTurns((turns) => turns + 1);
          }

          // Keep the learner's latest STT result visible briefly, then return
          // to the rotating practice hint. A short window avoids stale captions
          // lingering on screen (which read as "lag").
          if (captionClearRef.current) clearTimeout(captionClearRef.current);
          captionClearRef.current = setTimeout(() => {
            if (mountedRef.current) setRecognizedSpeech(null);
          }, 4000);
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

      hasConnectedRef.current = true;
      setAgentStatus("connected");
    } catch (error) {
      await cleanup({ resetState: false });
      setCallPhase("error");
      setAgentStatus("failed");
      setErrorMessage(getErrorMessage(error));
    } finally {
      isStartingRef.current = false;
    }
  }, [lesson, getToken, cleanup, recordReviewResult]);

  // Auto-start once on mount
  useEffect(() => {
    if (hasStartedRef.current || !lesson) return;
    hasStartedRef.current = true;
    void handleStartLesson();
  }, [lesson, handleStartLesson]);

  // ── End call ───────────────────────────────────────────────────────────────
  // "Finished" means Duo actually wrapped the lesson up (signaled by its own
  // closing line, see lessonWrappedUpRef) — not just "spoke a few times" or
  // "stayed a minute," which used to award XP for leaving right away.
  const finishAndExit = useCallback(
    async (awardXp: boolean) => {
      const justCompleted = Boolean(lesson && !hasAwardedXpRef.current && awardXp);
      if (lesson && justCompleted) {
        hasAwardedXpRef.current = true;
        lessonCompletedRef.current = true;
        // recordActivity first so daily-XP resets before completeLesson adds the reward.
        recordActivity();
        completeLesson(lesson.id, lesson.xpReward);
        trackLessonCompleted(posthog, {
          lesson_id: lesson.id,
          language: lesson.languageId,
          spoken_turns: spokenTurns,
          xp_reward: lesson.xpReward,
        });
      }
      setCallPhase("ending");
      await cleanup({ resetState: false });
      // After a real lesson, send the learner into personalized practice that
      // reinforces exactly what they just heard (plus anything now due for review).
      if (lesson && justCompleted) {
        router.replace(`/practice?lessonId=${lesson.id}` as Href);
      } else {
        router.back();
      }
    },
    [cleanup, lesson, spokenTurns, completeLesson, recordActivity, posthog],
  );

  const handleEndCall = useCallback(() => {
    if (lessonWrappedUpRef.current) {
      void finishAndExit(true);
      return;
    }

    // Duo hasn't wrapped up yet — confirm before throwing away progress and
    // leaving without XP, instead of silently ending (and previously, silently
    // awarding XP anyway).
    Alert.alert(
      "Leave the lesson?",
      "You haven't finished yet — Duo hasn't wrapped up this lesson. If you leave now, you won't earn XP for it.",
      [
        { text: "Keep learning", style: "cancel" },
        {
          text: "Leave anyway",
          style: "destructive",
          onPress: () => void finishAndExit(false),
        },
      ],
    );
  }, [finishAndExit]);

  // ── Rotating hints ───────────────────────────────────────────────────────
  // Hints from the lesson's own chunks/phrases, shown one at a time while the
  // learner listens (see the practice panel) so the screen always suggests
  // *what to say next* instead of one static line that read as "always the same".
  const sayHints = useMemo(() => buildSayHints(lesson), [lesson]);

  // Cycle the "try saying" hint every few seconds while the lesson is live.
  useEffect(() => {
    if (callPhase !== "active" || sayHints.length <= 1) return;
    const timer = setInterval(() => {
      setHintIndex((index) => index + 1);
    }, 6000);
    return () => clearInterval(timer);
  }, [callPhase, sayHints.length]);

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
  // The lesson goal stays on screen as a stable reference, instead of a single
  // "say this" word that tried (unreliably) to track the conversation.
  const goalText = lesson?.pedagogy?.canDo ?? lesson?.description ?? "";

  const currentHint =
    sayHints.length > 0 ? sayHints[hintIndex % sayHints.length] : null;
  // Once the learner has engaged a little, surface a gentle wrap-up hint —
  // finishing is learner-driven (hang up after Duo wraps the lesson).
  const readyToFinish =
    callPhase === "active" &&
    agentStatus === "connected" &&
    spokenTurns >= MIN_TURNS_FOR_XP;
  const lessonStatusValue =
    agentStatus === "connected" ? "In progress" : "Connecting";

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
                  You said
                </Text>
                <Text
                  className="mt-1 text-[18px] leading-[25px] font-poppins-semibold text-[#1B2340]"
                  numberOfLines={2}
                  selectable
                >
                  {`"${recognizedSpeech}"`}
                </Text>
                <Text className="mt-1 text-[10px] leading-[14px] font-poppins-regular text-[#9AA1B3]">
                  Live transcript — Duo listens to your audio, so just keep talking.
                </Text>
              </>
            ) : readyToFinish ? (
              <>
                <Text className="text-[11px] leading-[16px] font-poppins-semibold uppercase tracking-[1px] text-[#1FA45A]">
                  Doing great
                </Text>
                <Text className="mt-1 text-[15px] leading-[21px] font-poppins-semibold text-[#1B2340]">
                  Keep going with Duo. When Duo says you&apos;re done, tap the red
                  button to finish and claim your XP.
                </Text>
              </>
            ) : currentHint ? (
              <>
                <Text className="text-[11px] leading-[16px] font-poppins-semibold uppercase tracking-[1px] text-[#7D6BE8]">
                  Try saying
                </Text>
                <Text
                  className="mt-1 text-[18px] leading-[25px] font-poppins-semibold text-[#1B2340]"
                  numberOfLines={2}
                >
                  {currentHint.text}
                </Text>
                <Text className="mt-1 text-[12px] leading-[17px] font-poppins-regular text-[#69728A]">
                  {currentHint.translation}
                </Text>
              </>
            ) : (
              <>
                <Text className="text-[11px] leading-[16px] font-poppins-semibold uppercase tracking-[1px] text-[#7D6BE8]">
                  This lesson
                </Text>
                <Text className="mt-1 text-[16px] leading-[22px] font-poppins-semibold text-[#1B2340]">
                  {goalText || "Listen to Duo and follow along."}
                </Text>
                <Text className="mt-1 text-[12px] leading-[17px] font-poppins-regular text-[#69728A]">
                  Follow Duo&apos;s lead and say each phrase out loud.
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
          <StatItem
            color="#6484E8"
            label="Your turns"
            value={`${spokenTurns}`}
          />
          <View className="h-[34px] w-px bg-[#E9E9F0]" />
          <StatItem
            color="#6E55C9"
            label="Lesson"
            value={lessonStatusValue}
          />
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

const STRUGGLE_MARKER = "let's practice these again";

// Duo is prompted to say "Let's practice these again: <chunk>, <chunk>" in its
// wrap-up when something needed all 3 attempts and still wasn't right. This
// pulls the review ids for whichever of the lesson's own chunks got named
// there, so those exact items — not a generic due list — surface first in the
// practice session right after the call. Best-effort: if Duo never says the
// marker (nothing was missed, or it phrased the wrap-up differently), this
// simply returns no ids and practice falls back to the normal due/weak mix.
function extractStruggledChunkIds(agentTranscript: string, lesson: Lesson): string[] {
  const normalized = agentTranscript.toLowerCase();
  const markerIndex = normalized.indexOf(STRUGGLE_MARKER);
  if (markerIndex === -1) return [];

  // Only look at what Duo said shortly after the marker, so a chunk mentioned
  // much earlier for an unrelated reason doesn't get pulled in by accident.
  const window = normalized.slice(
    markerIndex + STRUGGLE_MARKER.length,
    markerIndex + STRUGGLE_MARKER.length + 200,
  );

  const chunks = lesson.pedagogy?.targetChunks ?? [];
  const ids: string[] = [];
  for (const chunk of chunks) {
    const term = chunk.text.toLowerCase().replace(/[¿?¡!.,]/g, "").trim();
    if (term && window.includes(term)) {
      ids.push(makeReviewId(lesson.id, chunk.id));
    }
  }
  return ids;
}

// The phrases the learner should try, drawn from the lesson's own content. The
// practice panel rotates through these so it always suggests something concrete.
function buildSayHints(
  lesson: Lesson | null,
): { text: string; translation: string }[] {
  if (!lesson) return [];

  if (lesson.pedagogy?.targetChunks.length) {
    return lesson.pedagogy.targetChunks.map((chunk) => ({
      text: chunk.text,
      translation: chunk.translation,
    }));
  }

  return [
    ...lesson.phrases.map((phrase) => ({
      text: phrase.text,
      translation: phrase.translation,
    })),
    ...lesson.vocabulary.map((item) => ({
      text: item.term,
      translation: item.translation,
    })),
  ];
}

// 1-based position of the lesson within its unit, used as lesson_number.
function getLessonNumber(lesson: Lesson): number {
  const unit = units.find((item) => item.id === lesson.unitId);
  const index = unit
    ? unit.lessonIds.findIndex((id) => id === lesson.id)
    : -1;
  return index >= 0 ? index + 1 : 1;
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
