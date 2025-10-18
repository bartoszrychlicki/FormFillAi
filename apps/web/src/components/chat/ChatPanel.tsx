"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { parseConversationSchema, type ConversationSchema } from "@formfillai/shared";

import { TypingIndicator } from "./typing-indicator";
import { PromptSuggestions } from "./prompt-suggestions";

type ConversationStatus = "in_progress" | "completed";

interface ChatPanelProps {
  schemaUrl: string;
  title?: string;
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

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  base64Data: string;
}

const ALLOWED_FILE_TYPES = {
  "application/pdf": { extension: ".pdf", label: "PDF" },
  "text/csv": { extension: ".csv", label: "CSV" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { extension: ".xlsx", label: "Excel" },
  "application/vnd.ms-excel": { extension: ".xls", label: "Excel" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: ".docx", label: "Word" },
  "text/plain": { extension: ".txt", label: "Text" },
  "text/markdown": { extension: ".md", label: "Markdown" },
} as const;

const MAX_FILE_SIZE = 350 * 1024 * 1024; // 350 MB (Claude's limit)

export function ChatPanel({ schemaUrl, title }: ChatPanelProps) {
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
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const messageCounter = useRef(0);
  const nextMessageId = () => {
    messageCounter.current += 1;
    return `message-${messageCounter.current}`;
  };

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

        const startResponse = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schema: definition,
            schemaUrl,
            ...(uploadedFile ? { file: uploadedFile } : {}),
          }),
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

  const submitReply = async (value: string, { viaSuggestion = false }: { viaSuggestion?: boolean } = {}) => {
    const trimmed = viaSuggestion ? value : value.trim();

    if (
      !trimmed ||
      !sessionId ||
      isPending ||
      conversationStatus === "completed" ||
      !schema
    ) {
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
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          reply: fieldId ? { fieldId, value: trimmed } : { value: trimmed },
          ...(uploadedFile ? { file: uploadedFile } : {}),
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
      console.error("Failed to submit reply", err);
      setError("Unable to send your reply. Please try again.");
      setMessages((previous) => previous.slice(0, -1));
      if (!viaSuggestion) {
        setInputValue(trimmed);
      }
    } finally {
      setIsPending(false);
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

  const validateFile = (file: File): string | null => {
    if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
      return `File type "${file.type}" is not supported. Please upload PDF, CSV, Excel, Word, TXT, or Markdown files.`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the maximum allowed size of 350 MB.`;
    }

    return null;
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        } else {
          reject(new Error("Failed to read file as base64"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    setFileUploadError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setFileUploadError(validationError);
      return;
    }

    try {
      const base64Data = await convertFileToBase64(file);
      const uploadedFileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        base64Data,
      };
      setUploadedFile(uploadedFileData);
      setFileUploadError(null);

      // If conversation has already started, trigger immediate file analysis
      if (sessionId && schema) {
        await analyzeUploadedFile(uploadedFileData);
      }
    } catch (error) {
      console.error("Failed to process file", error);
      setFileUploadError("Failed to process the file. Please try again.");
    }
  };

  const analyzeUploadedFile = async (file: UploadedFile) => {
    if (!sessionId || !schema) return;

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/analyze-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          file,
          schemaId: schema.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze file: ${response.status}`);
      }

      const payload = await response.json();

      setMessages((previous) => [
        ...previous,
        {
          id: nextMessageId(),
          role: "bot",
          text: payload.analysis,
        },
      ]);
    } catch (err) {
      console.error("Failed to analyze uploaded file", err);
      setMessages((previous) => [
        ...previous,
        {
          id: nextMessageId(),
          role: "bot",
          text: `I received your file "${file.name}" but encountered an issue analyzing it. I'll still use it to help fill the form - please continue answering the questions.`,
        },
      ]);
    } finally {
      setIsPending(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Only set to false if we're leaving the container entirely
    const relatedTarget = event.relatedTarget as Node | null;
    const currentTarget = event.currentTarget as Node;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileUploadError(null);
  };

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
        {currentField?.type === "select" && currentField.options && currentField.options.length > 0 ? (
          <PromptSuggestions
            label="Quick replies"
            suggestions={currentField.options}
            onSelect={handleSuggestionSelect}
            disabled={isInitialising || isPending || conversationStatus === "completed"}
          />
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="chat-reply">
              Reply
            </label>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.csv,.xlsx,.xls,.docx,.txt,.md"
              onChange={handleFileInputChange}
              disabled={isInitialising || isPending || conversationStatus === "completed"}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-xs text-slate-600 hover:text-slate-900"
              title="Attach document"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </label>
          </div>
          <div
            className="relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              id="chat-reply"
              aria-label="Reply"
              className={`h-24 w-full resize-none rounded-md border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 ${
                isDragging
                  ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                  : "border-slate-200 bg-white focus:border-sky-500 focus:ring-sky-200"
              }`}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isInitialising || isPending || conversationStatus === "completed"}
              placeholder={isDragging ? "Drop file here..." : "Type your reply..."}
            />
            {isDragging && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-sky-500 bg-sky-50/80">
                <div className="flex flex-col items-center gap-2">
                  <svg className="h-8 w-8 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm font-medium text-sky-700">Drop file to attach</p>
                </div>
              </div>
            )}
          </div>
          {uploadedFile && (
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                <svg className="h-4 w-4 flex-shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="max-w-[200px] truncate text-xs font-medium text-slate-700">
                  {uploadedFile.name}
                </span>
                <span className="text-xs text-slate-500">
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  aria-label="Remove file"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          {fileUploadError && (
            <p className="text-xs text-red-600">{fileUploadError}</p>
          )}
        </div>
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
