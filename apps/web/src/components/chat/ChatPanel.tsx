"use client";

import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseConversationSchema, type ConversationSchema } from "@formfillai/shared";

import { TypingIndicator } from "./typing-indicator";
import { PromptSuggestions } from "./prompt-suggestions";

type ConversationStatus = "in_progress" | "completed";

interface ChatPanelProps {
  schemaUrl: string;
  title?: string;
  onSchemaLoad?: (schema: ConversationSchema) => void;
  onDataUpdate?: (data: Record<string, unknown>) => void;
  onPendingChange?: (isPending: boolean) => void;
  onExposeEditHandler?: (handler: (fieldId: string, newValue: string) => Promise<void>) => void;
}

interface WebhookDebugInfo {
  url: string;
  status: number | null;
  ok: boolean;
  body: string | null;
  request: {
    sessionId: string;
    schemaId: string;
    data: Record<string, unknown>;
  };
  error?: string;
}

interface ApiResponseDebug {
  webhook?: WebhookDebugInfo;
}

interface ApiResponse {
  sessionId: string;
  botMessage: string;
  conversationStatus: ConversationStatus;
  nextField: {
    fieldId: string;
    text: string;
    type: string;
    options?: string[];
  } | null;
  debug?: ApiResponseDebug;
}

type MessageRole = "bot" | "user" | "system";

interface Message {
  id: string;
  role: MessageRole;
  text: string;
}

export function ChatPanel({
  schemaUrl,
  title,
  onSchemaLoad,
  onDataUpdate,
  onPendingChange,
  onExposeEditHandler,
}: ChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isInitialising, setIsInitialising] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>("in_progress");
  const [error, setError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [currentField, setCurrentField] = useState<ApiResponse["nextField"]>(null);
  const [schema, setSchema] = useState<ConversationSchema | null>(null);
  const [schemaDefinition, setSchemaDefinition] = useState<unknown>(null);
  const [schemaLoadError, setSchemaLoadError] = useState<string | null>(null);
  const [collectedData, setCollectedData] = useState<Record<string, unknown>>({});

  const messageCounter = useRef(0);
  const nextMessageId = () => {
    messageCounter.current += 1;
    return `message-${messageCounter.current}`;
  };

  const onSchemaLoadRef = useRef(onSchemaLoad);
  useEffect(() => {
    onSchemaLoadRef.current = onSchemaLoad;
  }, [onSchemaLoad]);

  const handleFieldEdit = useCallback(
    async (fieldId: string, newValue: string) => {
      if (!sessionId || isPending || !schema) {
        return;
      }

      const updatedData = { ...collectedData, [fieldId]: newValue };
      setCollectedData(updatedData);
      onDataUpdate?.(updatedData);

      const userMessage: Message = {
        id: nextMessageId(),
        role: "user",
        text: newValue,
      };

      setMessages((previous) => [...previous, userMessage]);
      setIsPending(true);
      onPendingChange?.(true);
      setError(null);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            reply: { fieldId, value: newValue },
          }),
        });

        if (!response.ok) {
          throw new Error(`Unexpected status ${response.status}`);
        }

        const payload = (await response.json()) as ApiResponse;
        if (payload.debug?.webhook) {
          console.info("[FormFillAI] Webhook delivery result", payload.debug.webhook);
        }
        setConversationStatus(payload.conversationStatus);
        setCurrentField(payload.nextField);
        setMessages((previous) => [
          ...previous,
          {
            id: nextMessageId(),
            role: "bot",
            text: payload.botMessage,
          },
        ]);
      } catch (err) {
        console.error("Failed to update field", err);
        setError("Unable to update the field. Please try again.");
        setMessages((previous) => previous.slice(0, -1));
        setCollectedData(collectedData);
        onDataUpdate?.(collectedData);
      } finally {
        setIsPending(false);
        onPendingChange?.(false);
      }
    },
    [sessionId, isPending, schema, collectedData, onDataUpdate, onPendingChange],
  );

  useEffect(() => {
    if (onExposeEditHandler) {
      onExposeEditHandler(handleFieldEdit);
    }
  }, [onExposeEditHandler, handleFieldEdit]);

  useEffect(() => {
    let cancelled = false;

    const resetConversationState = () => {
      setSessionId(null);
      setMessages([]);
      setInputValue("");
      setIsPending(false);
      setConversationStatus("in_progress");
      setCurrentField(null);
      setError(null);
      setCollectedData({});
    };

    const loadSchemaAndStartConversation = async () => {
      setIsInitialising(true);
      setSchemaLoadError(null);
      setSchema(null);
      setSchemaDefinition(null);
      resetConversationState();

      try {
        const response = await fetch(schemaUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Schema fetch failed with status ${response.status}`);
        }

        const definition = (await response.json()) as unknown;
        const parsed = parseConversationSchema(definition);

        if (cancelled) {
          return;
        }

        setSchema(parsed);
        setSchemaDefinition(definition);
        onSchemaLoadRef.current?.(parsed);

        const startResponse = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schema: definition, schemaUrl }),
        });

        if (!startResponse.ok) {
          throw new Error(`Unexpected status ${startResponse.status}`);
        }

        if (cancelled) {
          return;
        }

        const payload = (await startResponse.json()) as ApiResponse;
        if (payload.debug?.webhook) {
          console.info("[FormFillAI] Webhook delivery result", payload.debug.webhook);
        }

        setSessionId(payload.sessionId);
        setConversationStatus(payload.conversationStatus);
        setCurrentField(payload.nextField);
        setMessages([
          {
            id: nextMessageId(),
            role: "bot",
            text: payload.botMessage,
          },
        ]);
      } catch (err) {
        console.error("Failed to prepare conversation", err);
        if (!cancelled) {
          setSchemaLoadError(
            err instanceof Error ? err.message : "Unable to load conversation schema.",
          );
          setError("Unable to start the conversation. Please try again later.");
        }
      } finally {
        if (!cancelled) {
          setIsInitialising(false);
        }
      }
    };

    loadSchemaAndStartConversation();

    return () => {
      cancelled = true;
    };
  }, [schemaUrl]);

  const submitReply = async (
    value: string,
    { viaSuggestion = false }: { viaSuggestion?: boolean } = {},
  ) => {
    const trimmed = viaSuggestion ? value : value.trim();

    if (!trimmed || !sessionId || isPending || conversationStatus === "completed" || !schema) {
      return;
    }

    const fieldId = currentField?.fieldId;

    const userMessage: Message = {
      id: nextMessageId(),
      role: "user",
      text: trimmed,
    };

    setMessages((previous) => [...previous, userMessage]);
    if (!viaSuggestion) {
      setInputValue("");
    }
    setIsPending(true);
    onPendingChange?.(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          reply: fieldId ? { fieldId, value: trimmed } : { value: trimmed },
        }),
      });

      if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
      }

      const payload = (await response.json()) as ApiResponse;
      if (payload.debug?.webhook) {
        console.info("[FormFillAI] Webhook delivery result", payload.debug.webhook);
      }
      setConversationStatus(payload.conversationStatus);
      setCurrentField(payload.nextField);
      setMessages((previous) => [
        ...previous,
        {
          id: nextMessageId(),
          role: "bot",
          text: payload.botMessage,
        },
      ]);

      if (fieldId) {
        const updatedData = { ...collectedData, [fieldId]: trimmed };
        setCollectedData(updatedData);
        onDataUpdate?.(updatedData);
      }
    } catch (err) {
      console.error("Failed to submit reply", err);
      setError("Unable to send your reply. Please try again.");
      setMessages((previous) => previous.slice(0, -1));
      if (!viaSuggestion) {
        setInputValue(trimmed);
      }
    } finally {
      setIsPending(false);
      onPendingChange?.(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitReply(inputValue);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    void submitReply(suggestion, { viaSuggestion: true });
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void submitReply(inputValue);
  };

  const schemaJson = useMemo(() => {
    if (!schemaDefinition) {
      return null;
    }
    return JSON.stringify(schemaDefinition, null, 2);
  }, [schemaDefinition]);

  return (
    <section className="flex h-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="text-lg font-semibold">Conversation Preview</h2>
        <p className="text-sm text-slate-500">
          Schema: <span className="font-medium">{schema?.id ?? "Loading…"}</span>
        </p>
        {title ? <p className="text-xs text-slate-500">{title}</p> : null}
        {schemaLoadError ? (
          <p className="mt-2 text-sm text-red-600">Failed to load schema: {schemaLoadError}</p>
        ) : null}
      </header>

      <div className="space-y-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          onClick={() => setShowSchema((previous) => !previous)}
          aria-pressed={showSchema}
          disabled={!schemaJson}
        >
          {showSchema ? "Hide schema JSON" : "Show schema JSON"}
        </button>
        {showSchema && schemaJson ? (
          <textarea
            aria-label="Schema JSON preview"
            readOnly
            className="h-48 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700 shadow-inner"
            value={schemaJson}
          />
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto rounded-md border border-slate-100 bg-slate-50 p-4">
        {isInitialising ? (
          <p className="text-sm text-slate-500">Loading conversation…</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[80%] rounded-md bg-sky-600 px-3 py-2 text-sm text-white"
                    : "max-w-[80%] rounded-md bg-white px-3 py-2 text-sm text-slate-700 shadow"
                }
              >
                {message.text}
              </li>
            ))}
            {isPending && conversationStatus !== "completed" ? (
              <li className="max-w-[80%]">
                <TypingIndicator />
              </li>
            ) : null}
            {error ? (
              <li className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</li>
            ) : null}
          </ul>
        )}
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {currentField?.type === "select" &&
        currentField.options &&
        currentField.options.length > 0 ? (
          <PromptSuggestions
            label="Quick replies"
            suggestions={currentField.options}
            onSelect={handleSuggestionSelect}
            disabled={isInitialising || isPending || conversationStatus === "completed"}
          />
        ) : null}
        <label className="text-sm font-medium" htmlFor="chat-reply">
          Reply
        </label>
        <textarea
          id="chat-reply"
          aria-label="Reply"
          className="h-24 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleInputKeyDown}
          disabled={isInitialising || isPending || conversationStatus === "completed"}
        />
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {conversationStatus === "completed"
              ? "Conversation completed"
              : isPending
                ? "Sending…"
                : messages.length === 0
                  ? ""
                  : "Waiting for your reply"}
          </span>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isInitialising || isPending || conversationStatus === "completed"}
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
