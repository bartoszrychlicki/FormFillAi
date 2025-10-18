"use client";

import {
  parseConversationSchema,
  type ConversationFieldType,
  type ConversationSchema,
} from "@formfillai/shared";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ConversationController,
  ConversationMessage,
  ConversationState,
  ConversationSubmitInput,
  FormFillBehaviorConfig,
  FormFillChatEvent,
  SchemaSource,
} from "../types";
import type {
  ContinueConversationRequest,
  FormFillResponsePayload,
  StartConversationRequest,
} from "../../server/createFormFillHandler";

export interface ConversationApiClient {
  startConversation(input: StartConversationPayload): Promise<FormFillResponsePayload>;
  continueConversation(input: ContinueConversationPayload): Promise<FormFillResponsePayload>;
}

export interface StartConversationPayload extends StartConversationRequest {
  schemaUrl?: string;
}

export interface ContinueConversationPayload extends ContinueConversationRequest {}

interface UseConversationControllerOptions {
  schemaSource: SchemaSource;
  apiClient: ConversationApiClient;
  behavior: FormFillBehaviorConfig;
}

interface ResolvedSchema {
  schema: ConversationSchema;
  definition: unknown;
}

const INITIAL_STATE: ConversationState = {
  status: "idle",
  messages: [],
  currentField: null,
  isPending: false,
  error: null,
};

const MESSAGE_ID_PREFIX = "formfill-message";

export function useConversationController(
  options: UseConversationControllerOptions,
): ConversationController {
  const { schemaSource, apiClient, behavior } = options;

  const [state, setState] = useState<ConversationState>(INITIAL_STATE);
  const schemaRef = useRef<ConversationSchema | null>(null);
  const inflightStartRef = useRef<Promise<void> | null>(null);
  const abortStartRef = useRef(false);
  const messageCounterRef = useRef(0);

  const emitEvent = useCallback(
    (event: FormFillChatEvent) => {
      behavior.onEvent?.(event);
    },
    [behavior],
  );

  const nextMessageId = useCallback(() => {
    messageCounterRef.current += 1;
    return `${MESSAGE_ID_PREFIX}-${messageCounterRef.current}`;
  }, []);

  const loadSchema = useCallback(async (): Promise<ResolvedSchema> => {
    if (schemaSource.kind === "url") {
      const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;
      if (!fetchFn) {
        throw new Error("Fetch API is not available in this environment.");
      }

      const response = await fetchFn(schemaSource.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Schema fetch failed with status ${response.status}`);
      }
      const definition = (await response.json()) as unknown;
      const schema = parseConversationSchema(definition);
      return { schema, definition };
    }

    const schema = await schemaSource.loader();
    return { schema, definition: schema };
  }, [schemaSource]);

  const resetState = useCallback(() => {
    setState(INITIAL_STATE);
    schemaRef.current = null;
    messageCounterRef.current = 0;
  }, []);

  const handleStart = useCallback(async () => {
    abortStartRef.current = false;
    resetState();
    setState((previous) => ({
      ...previous,
      status: "loading",
      error: null,
    }));

    try {
      const resolved = await loadSchema();
      if (abortStartRef.current) {
        return;
      }

      schemaRef.current = resolved.schema;

      const startPayload: StartConversationPayload =
        schemaSource.kind === "url"
          ? { schema: resolved.definition, schemaUrl: schemaSource.url }
          : { schema: resolved.definition };

      const startResponse = await apiClient.startConversation(startPayload);

      if (abortStartRef.current) {
        return;
      }

      const status = determineStatus(startResponse);
      const messages: ConversationMessage[] = startResponse.botMessage
        ? [
            {
              id: nextMessageId(),
              role: "bot",
              text: startResponse.botMessage,
            },
          ]
        : [];

      setState({
        status,
        sessionId: startResponse.sessionId,
        schema: resolved.schema,
        messages,
        currentField: startResponse.nextField
          ? mapNextFieldPayload(startResponse.nextField)
          : null,
        isPending: false,
        error: null,
      });

      emitEvent({ type: "session-start", sessionId: startResponse.sessionId });
      if (status === "completed") {
        emitEvent({
          type: "session-complete",
          sessionId: startResponse.sessionId,
          payload: undefined,
        });
      }
    } catch (error) {
      if (abortStartRef.current) {
        return;
      }

      globalThis.console?.error?.("FormFillChat failed to start conversation", error);
      setState({
        ...INITIAL_STATE,
        status: "error",
        error: error instanceof Error ? error.message : "Unable to start the conversation.",
      });
      emitEvent({
        type: "error",
        message: "Unable to start the conversation.",
        cause: error,
      });
    }
  }, [apiClient, emitEvent, loadSchema, nextMessageId, resetState, schemaSource]);

  const start = useCallback(async () => {
    if (!inflightStartRef.current) {
      inflightStartRef.current = handleStart().finally(() => {
        inflightStartRef.current = null;
      });
    }
    return inflightStartRef.current;
  }, [handleStart]);

  const submit = useCallback(
    async (input: ConversationSubmitInput) => {
      const snapshot = state;
      const sessionId = snapshot.sessionId;
      const schema = schemaRef.current;

      if (!sessionId || !schema) {
        return false;
      }

      if (snapshot.status === "loading" || snapshot.isPending) {
        return false;
      }

      const rawValue = input.value;
      const value = input.viaSuggestion ? rawValue : rawValue.trim();
      if (!value) {
        return false;
      }

      const field = snapshot.currentField;
      const userMessage: ConversationMessage = {
        id: nextMessageId(),
        role: "user",
        text: value,
      };

      setState((previous) => ({
        ...previous,
        messages: [...previous.messages, userMessage],
        isPending: true,
        error: null,
      }));

      try {
        const response = await apiClient.continueConversation({
          sessionId,
          reply: {
            fieldId: field?.id,
            value,
          },
        });

        const status = determineStatus(response);
        const botMessage: ConversationMessage = {
          id: nextMessageId(),
          role: "bot",
          text: response.botMessage,
        };

        setState((previous) => ({
          ...previous,
          status,
          messages: [...previous.messages, botMessage],
          currentField: response.nextField ? mapNextFieldPayload(response.nextField) : null,
          isPending: false,
          error: null,
        }));

        if (status === "completed") {
          emitEvent({
            type: "session-complete",
            sessionId,
            payload: undefined,
          });
        }
        return true;
      } catch (error) {
        globalThis.console?.error?.("FormFillChat failed to submit reply", error);
        setState((previous) => ({
          ...previous,
          messages: previous.messages.slice(0, -1),
          isPending: false,
          error: "Unable to send your reply. Please try again.",
        }));

        emitEvent({
          type: "network-error",
          message: "Unable to send your reply. Please try again.",
          retryable: true,
        });
        return false;
      }
    },
    [apiClient, emitEvent, nextMessageId, state],
  );

  const reset = useCallback(async () => {
    abortStartRef.current = true;
    resetState();
    await start();
  }, [resetState, start]);

  useEffect(() => {
    abortStartRef.current = false;
    void start();

    return () => {
      abortStartRef.current = true;
    };
  }, [schemaSource, start]);

  return useMemo<ConversationController>(
    () => ({
      get state() {
        return state;
      },
      start,
      submit,
      reset,
    }),
    [reset, start, state, submit],
  );
}

function determineStatus(
  response: FormFillResponsePayload,
): "in_progress" | "completed" {
  if (response.status === "completed") {
    return "completed";
  }

  if (
    "conversationStatus" in response &&
    response.conversationStatus === "completed"
  ) {
    return "completed";
  }

  return "in_progress";
}

function mapNextFieldPayload(payload: FormFillResponsePayload["nextField"]) {
  if (!payload) {
    return null;
  }

  return {
    id: payload.fieldId,
    text: payload.text,
    type: payload.type as ConversationFieldType,
    options: payload.options,
  };
}
