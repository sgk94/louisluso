import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/zoho/auth";

export type ZohoProduct = "inventory" | "books" | "crm";

const ORG_HEADERS: Record<ZohoProduct, string> = {
  inventory: "X-com-zoho-inventory-organizationid",
  books: "X-com-zoho-books-organizationid",
  crm: "X-com-zoho-crm-organizationid",
};

interface ZohoFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  product?: ZohoProduct;
}

export async function zohoFetch<T = unknown>(
  path: string,
  options?: ZohoFetchOptions,
): Promise<T> {
  const token = await getAccessToken();
  const method = options?.method ?? "GET";
  const product = options?.product ?? detectProduct(path);

  const url = new URL(`${env.ZOHO_API_BASE_URL}${path}`);
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${token}`,
    [ORG_HEADERS[product]]: env.ZOHO_ORG_ID,
  };

  let body: string | undefined;
  if (options?.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url.toString(), { method, headers, body });
  } catch (err) {
    console.info(
      JSON.stringify({
        tag: "zoho_call",
        method,
        endpoint: path,
        status: 0,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    throw err;
  }

  const ms = Date.now() - startedAt;
  console.info(
    JSON.stringify({
      tag: "zoho_call",
      method,
      endpoint: path,
      status: response.status,
      ms,
    }),
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Zoho API error [${method} ${path}]: ${response.status} ${errorBody}`);
    throw new ZohoApiError(
      "Zoho API request failed",
      errorBody,
      response.status,
    );
  }

  const json = await response.json();

  if (typeof json === "object" && json !== null && "code" in json && (json as Record<string, unknown>).code !== 0) {
    const msg = (json as Record<string, unknown>).message ?? "Unknown Zoho error";
    console.error(`Zoho API error [${method} ${path}]: code=${(json as Record<string, unknown>).code} ${msg}`);
    throw new ZohoApiError(
      "Zoho API request failed",
      String(msg),
      200,
    );
  }

  return json as T;
}

function detectProduct(path: string): ZohoProduct {
  if (path.startsWith("/inventory")) return "inventory";
  if (path.startsWith("/books")) return "books";
  if (path.startsWith("/crm")) return "crm";
  return "inventory";
}

export class ZohoApiError extends Error {
  constructor(
    message: string,
    public readonly internalDetails: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ZohoApiError";
  }
}
