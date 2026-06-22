import { verifyToken } from "@clerk/backend";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

type StartAgentBody = {
  callId?: unknown;
  callType?: unknown;
};

type StopAgentBody = {
  callId?: unknown;
  sessionId?: unknown;
};

type VisionAgentSessionResponse = {
  call_id?: string;
  session_id?: string;
  session_started_at?: string;
};

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const env = getRequiredEnv();
    const authResult = await requireAuth(request, env.clerkSecretKey);

    if (authResult instanceof Response) {
      return authResult;
    }

    const body = (await request.json().catch(() => null)) as StartAgentBody | null;

    if (!body || typeof body.callId !== "string") {
      return jsonError("Missing callId.", 400);
    }

    if (typeof body.callType !== "string") {
      return jsonError("Missing callType.", 400);
    }

    if (body.callType !== "audio_room") {
      return jsonError("Unsupported callType.", 400);
    }

    if (!body.callId.startsWith("audio-")) {
      return jsonError("Unsupported callId.", 400);
    }

    const response = await visionAgentRequest<VisionAgentSessionResponse>({
      baseUrl: env.visionAgentUrl,
      body: {
        call_type: body.callType,
      },
      method: "POST",
      path: `/calls/${encodeURIComponent(body.callId)}/sessions`,
    });

    if (!response.session_id) {
      return jsonError("Vision Agent did not return a session id.", 502);
    }

    return Response.json(
      {
        callId: response.call_id ?? body.callId,
        sessionId: response.session_id,
        startedAt: response.session_started_at,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Vision Agent session start failed", error);
    return jsonError("Unable to connect the AI teacher.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const env = getRequiredEnv();
    const authResult = await requireAuth(request, env.clerkSecretKey);

    if (authResult instanceof Response) {
      return authResult;
    }

    const body = (await request.json().catch(() => null)) as StopAgentBody | null;

    if (!body || typeof body.callId !== "string") {
      return jsonError("Missing callId.", 400);
    }

    if (typeof body.sessionId !== "string") {
      return jsonError("Missing sessionId.", 400);
    }

    if (!body.callId.startsWith("audio-")) {
      return jsonError("Unsupported callId.", 400);
    }

    await visionAgentRequest({
      baseUrl: env.visionAgentUrl,
      method: "DELETE",
      path: `/calls/${encodeURIComponent(body.callId)}/sessions/${encodeURIComponent(
        body.sessionId,
      )}`,
    });

    return new Response(null, { headers: corsHeaders, status: 204 });
  } catch (error) {
    console.error("Vision Agent session stop failed", error);
    return jsonError("Unable to stop the AI teacher.", 500);
  }
}

async function requireAuth(request: Request, clerkSecretKey: string) {
  const clerkToken = getBearerToken(request);

  if (!clerkToken) {
    return jsonError("Missing Clerk session token.", 401);
  }

  const verifiedToken = await verifyToken(clerkToken, {
    secretKey: clerkSecretKey,
  });

  if (typeof verifiedToken.sub !== "string" || verifiedToken.sub.length === 0) {
    return jsonError("Invalid Clerk session token.", 401);
  }

  return {
    userId: verifiedToken.sub,
  };
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
  const visionAgentUrl =
    process.env.VISION_AGENT_URL ?? "http://localhost:8000";

  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY is not configured.");
  }

  return {
    clerkSecretKey,
    visionAgentUrl,
  };
}

type VisionAgentRequestInput = {
  baseUrl: string;
  body?: unknown;
  method: "POST" | "DELETE";
  path: string;
};

async function visionAgentRequest<TResponse = unknown>({
  baseUrl,
  body,
  method,
  path,
}: VisionAgentRequestInput): Promise<TResponse> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl.replace(/\/$/, "")}${normalizedPath}`;
  const response = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined
        ? undefined
        : {
            "Content-Type": "application/json",
          },
    method,
  });

  if (response.status === 204 || response.status === 202) {
    return {} as TResponse;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : `Vision Agent request failed with ${response.status}.`;

    throw new Error(message);
  }

  return payload as TResponse;
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { headers: corsHeaders, status });
}
