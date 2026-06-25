import { createClerkClient, verifyToken } from "@clerk/backend";

import { languages } from "@/data/languages";
import { lessonsById } from "@/data/lessons";
import type { LanguageId, Lesson, LessonId } from "@/types/learning";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

type CreateAudioCallBody = {
  languageId?: unknown;
  lessonId?: unknown;
};

type StreamGetOrCreateCallResponse = {
  call?: {
    cid?: string;
  };
  created: boolean;
};

const STREAM_VIDEO_BASE_URL = "https://video.stream-io-api.com/api/v2/video";
const STREAM_API_BASE_URL = "https://video.stream-io-api.com/api/v2";
const AI_TEACHER_USER_ID = "duo-ai-teacher";

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const env = getRequiredEnv();
    const clerkToken = getBearerToken(request);

    if (!clerkToken) {
      return jsonError("Missing Clerk session token.", 401);
    }

    const body = (await request.json().catch(() => null)) as
      | CreateAudioCallBody
      | null;

    if (!body || typeof body.lessonId !== "string") {
      return jsonError("Missing lessonId.", 400);
    }

    if (!isLanguageId(body.languageId)) {
      return jsonError("Missing or invalid languageId.", 400);
    }

    const lesson = lessonsById[body.lessonId];

    if (!lesson) {
      return jsonError("Lesson not found.", 404);
    }

    if (lesson.languageId !== body.languageId) {
      return jsonError("Lesson does not match the selected language.", 400);
    }

    const verifiedToken = await verifyToken(clerkToken, {
      secretKey: env.clerkSecretKey,
    });
    const userId = verifiedToken.sub;

    if (typeof userId !== "string" || userId.length === 0) {
      return jsonError("Invalid Clerk session token.", 401);
    }

    const clerkClient = createClerkClient({
      secretKey: env.clerkSecretKey,
    });
    const clerkUser = await clerkClient.users.getUser(userId);
    const displayName =
      clerkUser.fullName ??
      clerkUser.primaryEmailAddress?.emailAddress ??
      "Language learner";
    const userImage = clerkUser.imageUrl || undefined;
    const serverToken = await createStreamJwt({ server: true }, env.streamSecret);
    const streamUser = {
      id: userId,
      image: userImage,
      name: displayName,
      custom: {
        clerkUserId: userId,
        selectedLanguageId: body.languageId,
      },
    };

    await streamRequest({
      apiKey: env.streamApiKey,
      baseUrl: STREAM_API_BASE_URL,
      body: {
        users: {
          [streamUser.id]: streamUser,
          [AI_TEACHER_USER_ID]: {
            id: AI_TEACHER_USER_ID,
            name: "Duo AI Teacher",
            custom: {
              role: "ai-teacher",
            },
          },
        },
      },
      method: "POST",
      path: "/users",
      token: serverToken,
    });

    const callType = "audio_room";
    const callId = createCallId(lesson, body.languageId);
    const language = languages.find((item) => item.id === body.languageId);
    const languageContext = {
      id: body.languageId,
      name: language?.name ?? body.languageId,
      nativeName: language?.nativeName,
    };
    const lessonContext = {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      goals: lesson.goals,
      vocabulary: lesson.vocabulary,
      phrases: lesson.phrases,
      aiTeacherPrompt: lesson.aiTeacherPrompt,
    };
    const callResponse = await streamRequest<StreamGetOrCreateCallResponse>({
      apiKey: env.streamApiKey,
      baseUrl: STREAM_VIDEO_BASE_URL,
      body: {
        data: {
          created_by_id: streamUser.id,
          custom: {
            clerkUserId: userId,
            teacherUserId: AI_TEACHER_USER_ID,
            lesson: lessonContext,
            language: languageContext,
            aiTeacherPrompt: lesson.aiTeacherPrompt,
          },
          members: [
            {
              user_id: userId,
              role: "admin",
              custom: {
                lessonId: lesson.id,
                selectedLanguageId: body.languageId,
              },
            },
            {
              user_id: AI_TEACHER_USER_ID,
              role: "admin",
              custom: {
                lessonId: lesson.id,
                selectedLanguageId: body.languageId,
              },
            },
          ],
          settings_override: {
            audio: {
              default_device: "speaker",
              // Duo leads the lesson. The client enables the learner's mic only
              // after the agent has joined and begun its opening turn.
              mic_default_on: false,
              speaker_default_on: true,
            },
          },
        },
      },
      method: "POST",
      path: `/call/${encodeURIComponent(callType)}/${encodeURIComponent(callId)}`,
      token: serverToken,
    });
    const callCid = callResponse.call?.cid ?? `${callType}:${callId}`;

    await streamRequest({
      apiKey: env.streamApiKey,
      baseUrl: STREAM_VIDEO_BASE_URL,
      body: {},
      method: "POST",
      path: `/call/${encodeURIComponent(callType)}/${encodeURIComponent(callId)}/go_live`,
      token: serverToken,
    });

    const streamToken = await createStreamJwt(
      {
        call_cids: [callCid],
        role: "admin",
        user_id: userId,
        validity_in_seconds: 60 * 60,
      },
      env.streamSecret,
    );

    return Response.json(
      {
        apiKey: env.streamApiKey,
        callCid,
        callId,
        callType,
        created: callResponse.created,
        language: languageContext,
        lesson: {
          id: lesson.id,
          title: lesson.title,
        },
        token: streamToken,
        user: {
          id: userId,
          image: userImage,
          name: displayName,
        },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Stream audio call setup failed", error);
    return jsonError("Unable to start the audio lesson call.", 500);
  }
}

function getBearerToken(request: Request) {
  const header = request.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.replace("Bearer ", "").trim();
}

function getRequiredEnv() {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const streamApiKey =
    process.env.STREAM_API_KEY ?? process.env.EXPO_PUBLIC_STREAM_API_KEY;
  const streamSecret = process.env.STREAM_API_SECRET ?? process.env.STREAM_SECRET;

  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY is not configured.");
  }

  if (!streamApiKey) {
    throw new Error("STREAM_API_KEY is not configured.");
  }

  if (!streamSecret) {
    throw new Error("STREAM_API_SECRET or STREAM_SECRET is not configured.");
  }

  return {
    clerkSecretKey,
    streamApiKey,
    streamSecret,
  };
}

function isLanguageId(value: unknown): value is LanguageId {
  return (
    typeof value === "string" &&
    languages.some((language) => language.id === value)
  );
}

function createCallId(lesson: Lesson, languageId: LanguageId) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return [
    "audio",
    slugForCallId(languageId),
    slugForCallId(lesson.id),
    randomPart,
  ].join("-");
}

function slugForCallId(value: LessonId | LanguageId) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "item";
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { headers: corsHeaders, status });
}

type StreamRequestInput = {
  apiKey: string;
  baseUrl: string;
  body: unknown;
  method: "POST";
  path: string;
  token: string;
};

async function streamRequest<TResponse = unknown>({
  apiKey,
  baseUrl,
  body,
  method,
  path,
  token,
}: StreamRequestInput): Promise<TResponse> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${normalizedPath}`);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString(), {
    body: JSON.stringify(body),
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "stream-auth-type": "jwt",
      "X-Stream-Client": "dualingo-expo-api",
    },
    method,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      isStreamError(payload) && payload.message
        ? payload.message
        : `Stream request failed with ${response.status}.`;

    throw new Error(message);
  }

  return payload as TResponse;
}

type StreamJwtPayload = {
  call_cids?: string[];
  exp?: number;
  iat?: number;
  role?: string;
  server?: boolean;
  user_id?: string;
  validity_in_seconds?: number;
};

async function createStreamJwt(
  payload: StreamJwtPayload,
  secret: string,
): Promise<string> {
  const issuedAt = Math.floor((Date.now() - 1000) / 1000);
  const { validity_in_seconds: validityInSeconds, ...jwtPayload } = payload;
  const timedPayload = payload.user_id
    ? {
        ...jwtPayload,
        exp:
          payload.exp ??
          (payload.iat ?? issuedAt) + (validityInSeconds ?? 60 * 60),
        iat: payload.iat ?? issuedAt,
      }
    : jwtPayload;
  const encodedHeader = base64UrlEncode(
    JSON.stringify({
      alg: "HS256",
      typ: "JWT",
    }),
  );
  const encodedPayload = base64UrlEncode(JSON.stringify(timedPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function isStreamError(payload: unknown): payload is { message?: string } {
  return typeof payload === "object" && payload !== null && "message" in payload;
}
