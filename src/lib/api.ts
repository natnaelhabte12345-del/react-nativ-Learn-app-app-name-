type PostJsonOptions = {
  token?: string;
};

const REQUEST_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJson<TResponse>(
  path: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<TResponse> {
  const url = getApiUrl(path);
  const response = await fetchWithTimeout(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    method: "POST",
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, 0);
    }
    console.error("API network request failed", error);
    throw new ApiError(
      `Network request failed while calling ${url}. Restart Expo and make sure the native app is connected to the same dev server.`,
      0,
    );
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | TResponse
    | null;

  if (!response.ok) {
    throw new ApiError(
      isErrorPayload(payload) && payload.error
        ? payload.error
        : "Request failed",
      response.status,
    );
  }

  return payload as TResponse;
}

export async function deleteJson<TResponse>(
  path: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<TResponse> {
  const url = getApiUrl(path);
  const response = await fetchWithTimeout(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    method: "DELETE",
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, 0);
    }
    if (process.env.NODE_ENV === "development") {
      console.error("API network request failed", error);
    }
    throw new ApiError(
      `Network request failed while calling ${url}. Restart Expo and make sure the native app is connected to the same dev server.`,
      0,
    );
  });

  if (response.status === 204 || response.status === 202) {
    return {} as TResponse;
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | TResponse
    | null;

  if (!response.ok) {
    throw new ApiError(
      isErrorPayload(payload) && payload.error
        ? payload.error
        : "Request failed",
      response.status,
    );
  }

  return payload as TResponse;
}

function getApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && explicitApiUrl) {
    return `${explicitApiUrl.replace(/\/$/, "")}${normalizedPath}`;
  }

  return normalizedPath;
}

function isErrorPayload(payload: unknown): payload is { error?: string } {
  return typeof payload === "object" && payload !== null && "error" in payload;
}
