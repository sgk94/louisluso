import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/zoho/auth";

interface ZohoFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

export async function zohoFetch<T = unknown>(
  path: string,
  options?: ZohoFetchOptions,
): Promise<T> {
  const token = await getAccessToken();
  const method = options?.method ?? "GET";

  const url = new URL(`${env.ZOHO_API_BASE_URL}${path}`);
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${token}`,
    "X-com-zoho-inventory-organizationid": env.ZOHO_ORG_ID,
  };

  let body: string | undefined;
  if (options?.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), { method, headers, body });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Zoho API error ${response.status}: ${errorBody}`);
  }

  return (await response.json()) as T;
}
