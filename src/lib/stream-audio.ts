import { deleteJson, postJson } from "@/lib/api";
import type { LanguageId, LessonId } from "@/types/learning";

export type StreamAudioUser = {
  id: string;
  image?: string;
  name: string;
};

export type StreamAudioCallSession = {
  apiKey: string;
  callCid: string;
  callId: string;
  callType: string;
  created: boolean;
  language: {
    id: LanguageId;
    name: string;
  };
  lesson: {
    id: LessonId;
    title: string;
  };
  token: string;
  user: StreamAudioUser;
};

export type StreamAudioAgentSession = {
  callId: string;
  sessionId: string;
  startedAt?: string;
};

type CreateStreamAudioCallInput = {
  clerkToken: string;
  languageId: LanguageId;
  lessonId: LessonId;
};

export function createStreamAudioCall({
  clerkToken,
  languageId,
  lessonId,
}: CreateStreamAudioCallInput) {
  return postJson<StreamAudioCallSession>(
    "/api/stream/audio-call",
    {
      languageId,
      lessonId,
    },
    {
      token: clerkToken,
    },
  );
}

type StartStreamAudioAgentInput = {
  callId: string;
  callType: string;
  clerkToken: string;
};

export function startStreamAudioAgent({
  callId,
  callType,
  clerkToken,
}: StartStreamAudioAgentInput) {
  return postJson<StreamAudioAgentSession>(
    "/api/stream/audio-agent",
    {
      callId,
      callType,
    },
    {
      token: clerkToken,
    },
  );
}

type StopStreamAudioAgentInput = {
  callId: string;
  clerkToken: string;
  sessionId: string;
};

export function stopStreamAudioAgent({
  callId,
  clerkToken,
  sessionId,
}: StopStreamAudioAgentInput) {
  return deleteJson<Record<string, never>>(
    "/api/stream/audio-agent",
    {
      callId,
      sessionId,
    },
    {
      token: clerkToken,
    },
  );
}
