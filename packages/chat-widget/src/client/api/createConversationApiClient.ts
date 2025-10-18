"use client";

import type {
  ConversationApiClient,
  ContinueConversationPayload,
  StartConversationPayload,
} from "../controller/useConversationController";
import type { FormFillResponsePayload } from "../../server/createFormFillHandler";

export interface FormFillApiConfig {
  baseUrl?: string;
  transport?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  endpoint?: string;
  startEndpoint?: string; /* @deprecated use endpoint */
  headers?: Record<string, string>;
}

const DEFAULT_ENDPOINT = "/api/formfill";
const JSON_HEADERS = {
  "Content-Type": "application/json",
};

export function createConversationApiClient(
  config: FormFillApiConfig = {},
): ConversationApiClient {
  const transport = config.transport ?? getGlobalFetch();
  const endpoint = config.endpoint ?? config.startEndpoint ?? DEFAULT_ENDPOINT;
  const baseUrl = config.baseUrl ?? "";

  const target = resolveEndpoint(baseUrl, endpoint);

  const headers = {
    ...JSON_HEADERS,
    ...config.headers,
  };

  const send = async (payload: unknown) => {
    const response = await transport(target, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await safeReadText(response);
      throw new Error(`FormFill API request failed with status ${response.status}: ${text}`);
    }

    return (await response.json()) as unknown;
  };

  return {
    startConversation: async (payload: StartConversationPayload) => {
      return send(payload) as Promise<FormFillResponsePayload>;
    },
    continueConversation: async (payload: ContinueConversationPayload) => {
      return send(payload) as Promise<FormFillResponsePayload>;
    },
  };
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "<unreadable>";
  }
}

function getGlobalFetch(): typeof fetch {
  const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch : undefined;
  if (!fetchFn) {
    throw new Error("Fetch API is not available. Provide a custom transport implementation.");
  }
  return fetchFn.bind(globalThis);
}

function resolveEndpoint(baseUrl: string, endpoint: string) {
  const isAbsolute = /^https?:\/\//i.test(endpoint);
  if (isAbsolute) {
    return endpoint;
  }

  const normalisedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (!baseUrl) {
    return normalisedEndpoint;
  }

  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${normalisedEndpoint}`;
}
