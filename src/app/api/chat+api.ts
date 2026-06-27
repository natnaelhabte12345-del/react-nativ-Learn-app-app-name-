import { verifyToken } from "@clerk/backend";

import type { LanguageId } from "@/types/learning";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const languageNames: Record<LanguageId, string> = {
  chinese: "Mandarin Chinese",
  french: "French",
  german: "German",
  japanese: "Japanese",
  korean: "Korean",
  spanish: "Spanish",
};

type ChatMessage = {
  content: string;
  role: "assistant" | "user";
};

type ChatRequestBody = {
  languageId?: unknown;
  messages?: unknown;
};

type OpenAIChatResponse = {
  choices: { message: { content: string } }[];
};

type GeminiResponse = {
  candidates: { content: { parts: { text: string }[] } }[];
};

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;

    if (!clerkSecretKey) {
      return jsonError("Server configuration error.", 500);
    }

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

    const openaiKey = process.env.OPENAI_API_KEY;
    // Accept either common Gemini env var name so it works no matter how the key
    // was stored in .env (some setups use GOOGLE_API_KEY, others GEMINI_API_KEY).
    const googleKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;

    if (!openaiKey && !googleKey) {
      return jsonError(
        "Chat is not configured yet. Set OPENAI_API_KEY or GOOGLE_API_KEY on the server.",
        503,
      );
    }

    const body = (await request.json().catch(() => null)) as ChatRequestBody | null;

    if (!body || !Array.isArray(body.messages)) {
      return jsonError("Missing messages.", 400);
    }

    const messages = body.messages as ChatMessage[];
    const languageId =
      typeof body.languageId === "string" ? (body.languageId as LanguageId) : "spanish";
    const languageName = languageNames[languageId] ?? "the target language";

    const systemPrompt = `You are Duo, a friendly and encouraging ${languageName} language tutor in a text chat. Keep replies concise (2-3 sentences). Chat naturally, gently correct mistakes by modeling the correct form, and keep the conversation flowing. Sprinkle in words or short phrases in ${languageName} and always give the English meaning in parentheses right after. Be warm and fun.`;

    if (openaiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        body: JSON.stringify({
          max_tokens: 200,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
          temperature: 0.8,
        }),
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        console.error("OpenAI chat error", response.status);
        return jsonError("AI service error. Please try again.", 502);
      }

      const data = (await response.json()) as OpenAIChatResponse;
      const content = data.choices[0]?.message?.content ?? "Sorry, I couldn't respond.";
      return Response.json({ content }, { headers: corsHeaders });
    }

    // Gemini fallback when only GOOGLE_API_KEY is set. Default to a current model
    // (gemini-1.5-flash was retired); override with GEMINI_CHAT_MODEL if needed.
    const geminiModel = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.0-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${googleKey}`;

    const geminiContents = messages.map((m) => ({
      parts: [{ text: m.content }],
      role: m.role === "assistant" ? "model" : "user",
    }));

    const geminiResponse = await fetch(geminiUrl, {
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: { maxOutputTokens: 200, temperature: 0.8 },
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!geminiResponse.ok) {
      const detail = await geminiResponse.text().catch(() => "");
      console.error("Gemini chat error", geminiResponse.status, detail);
      return jsonError(
        `AI service error (${geminiResponse.status}). Check GOOGLE_API_KEY and GEMINI_CHAT_MODEL.`,
        502,
      );
    }

    const geminiData = (await geminiResponse.json()) as GeminiResponse;
    const content =
      geminiData.candidates[0]?.content?.parts[0]?.text ?? "Sorry, I couldn't respond.";

    return Response.json({ content }, { headers: corsHeaders });
  } catch (error) {
    console.error("Chat API error", error);
    return jsonError("Unable to get a response from the AI tutor.", 500);
  }
}

function getBearerToken(request: Request) {
  const header = request.headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.replace("Bearer ", "").trim();
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { headers: corsHeaders, status });
}
