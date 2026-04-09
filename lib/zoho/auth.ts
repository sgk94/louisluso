import { env } from "@/lib/env";

const ZOHO_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;
let refreshPromise: Promise<string> | null = null;

async function refreshToken(): Promise<string> {
  const params = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const response = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    body: params.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) {
    console.error(`Zoho token refresh failed: ${response.status} ${response.statusText}`);
    throw new Error("Zoho token refresh failed");
  }

  const data: { access_token: string; expires_in: number; token_type: string } =
    await response.json();

  cache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - EXPIRY_BUFFER_MS,
  };

  return cache.accessToken;
}

export async function getAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export function clearTokenCache(): void {
  cache = null;
  refreshPromise = null;
}
