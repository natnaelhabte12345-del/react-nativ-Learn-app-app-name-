export function OPTIONS() {
  return new Response(null, { headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      message?: string;
      stack?: string;
      context?: unknown;
      timestamp?: string;
      environment?: string;
    } | null;

    if (!body || !body.message) {
      return Response.json(
        { error: "Missing error message" },
        { status: 400 },
      );
    }

    // Log to server console with timestamp and environment
    const errorLog = {
      severity: "ERROR",
      timestamp: body.timestamp || new Date().toISOString(),
      environment: body.environment || "unknown",
      message: body.message,
      stack: body.stack,
      context: body.context,
    };

    // In production, this output should be captured by your logging service
    // (CloudWatch, Datadog, LogRocket, Sentry, etc.)
    console.error("[CLIENT_ERROR]", JSON.stringify(errorLog, null, 2));

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[LOG_ERROR_HANDLER_FAILED]", error);
    return Response.json(
      { error: "Failed to log error" },
      { status: 500 },
    );
  }
}
