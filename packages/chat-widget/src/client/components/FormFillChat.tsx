"use client";

import type { ConversationSchema } from "@formfillai/shared";
import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";

import { FormFillProvider, useFormFillContext } from "../context/FormFillProvider";
import {
  type FormFillAppearanceConfig,
  type FormFillBehaviorConfig,
  type SchemaSource,
  type ConversationController,
  type ConversationMessage,
} from "../types";
import { useConversationController } from "../controller/useConversationController";
import {
  createConversationApiClient,
  type FormFillApiConfig,
} from "../api/createConversationApiClient";
import { useConversation } from "../hooks/useConversation";

import "../../styles/index.css";

export interface FormFillChatProps {
  schemaUrl?: string;
  schemaLoader?: () => Promise<ConversationSchema>;
  title?: string;
  api?: FormFillApiConfig;
  appearance?: FormFillAppearanceConfig;
  behavior?: FormFillBehaviorConfig;
}

const defaultAppearance: FormFillAppearanceConfig = {
  className: undefined,
  theme: {},
  components: {},
};

const defaultBehavior: FormFillBehaviorConfig = {
  onEvent: undefined,
  retryPolicy: undefined,
  autoFocus: true,
};

export function FormFillChat(props: FormFillChatProps) {
  const { schemaUrl, schemaLoader, title, api, appearance, behavior } = props;

  const schemaSource = useMemo<SchemaSource>(() => {
    if (schemaUrl && schemaLoader) {
      throw new Error("Provide either schemaUrl or schemaLoader, not both.");
    }
    if (!schemaUrl && !schemaLoader) {
      throw new Error("FormFillChat requires a schemaUrl or schemaLoader.");
    }
    if (schemaUrl) {
      return { kind: "url", url: schemaUrl };
    }
    return { kind: "loader", loader: schemaLoader as () => Promise<ConversationSchema> };
  }, [schemaLoader, schemaUrl]);

  const appearanceConfig = useMemo(
    () => ({ ...defaultAppearance, ...(appearance ?? {}) }),
    [appearance],
  );
  const behaviorConfig = useMemo(
    () => ({ ...defaultBehavior, ...(behavior ?? {}) }),
    [behavior],
  );
  const apiClient = useMemo(() => createConversationApiClient(api), [api]);

  const controller = useConversationController({
    schemaSource,
    apiClient,
    behavior: behaviorConfig,
  });

  return (
    <FormFillProvider
      value={{
        controller,
        appearance: appearanceConfig,
        behavior: behaviorConfig,
        schemaSource,
      }}
    >
      <ChatShell title={title} />
    </FormFillProvider>
  );
}

interface ChatShellProps {
  title?: string;
}

function ChatShell({ title }: ChatShellProps) {
  const { appearance } = useFormFillContext();

  const themeStyle = useMemo(() => buildThemeStyle(appearance.theme), [appearance.theme]);
  const containerClassName = useMemo(() => {
    return ["formfill-chat", appearance.className].filter(Boolean).join(" ");
  }, [appearance.className]);

  return (
    <section className={containerClassName} style={themeStyle} data-formfill-chat>
      <ChatHeader title={title} />
      <ChatTranscript />
      <ChatComposer />
    </section>
  );
}

function ChatHeader({ title }: ChatShellProps) {
  const { controller } = useFormFillContext();
  const { state } = controller;
  const schemaId = state.schema?.id ?? "";

  return (
    <header className="formfill-chat__header">
      <h2 className="formfill-chat__title">{title ?? "Conversation"}</h2>
      {schemaId ? (
        <p className="formfill-chat__subtitle">Schema: {schemaId}</p>
      ) : null}
    </header>
  );
}

function ChatTranscript() {
  const { appearance } = useFormFillContext();
  const controller = useConversation();
  const { state } = controller;
  const MessageComponent = appearance.components?.Message ?? DefaultMessage;

  return (
    <div className="formfill-chat__messages" aria-live="polite">
      {state.status === "loading" ? (
        <p className="formfill-chat__status-text">Loading conversation…</p>
      ) : state.status === "error" ? (
        <p className="formfill-chat__error" role="alert">
          {state.error ?? "Unable to start the conversation."}
        </p>
      ) : state.messages.length === 0 ? (
        <p className="formfill-chat__status-text">Say hello to start the conversation.</p>
      ) : (
        <ul className="formfill-chat__messages-list">
          {state.messages.map((message) => (
            <li key={message.id} className={messageClassName(message)}>
              <MessageComponent message={message} className="formfill-chat__message-body" />
            </li>
          ))}
          {state.isPending && state.status !== "completed" ? (
            <li className="formfill-chat__message formfill-chat__message--bot">
              <TypingIndicator />
            </li>
          ) : null}
          {state.error ? (
            <li className="formfill-chat__error">{state.error}</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function ChatComposer() {
  const { controller, appearance, behavior } = useFormFillContext();
  const { state } = controller;
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const SuggestionsComponent = appearance.components?.Suggestions ?? DefaultSuggestions;

  const isConversationComplete = state.status === "completed";
  const isDisabled = state.isPending || state.status === "loading" || isConversationComplete;
  const showSuggestions = Boolean(
    state.currentField?.type === "select" && state.currentField.options?.length,
  );

  useEffect(() => {
    if (!behavior.autoFocus) {
      return;
    }
    if (state.status === "in_progress" && !state.isPending) {
      textareaRef.current?.focus();
    }
  }, [behavior.autoFocus, state.isPending, state.status]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = inputValue;
      if (!value.trim()) {
        return;
      }
      const success = await controller.submit({ value });
      if (success) {
        setInputValue("");
      }
    },
    [controller, inputValue],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      event.preventDefault();
      void submitFromComposer(controller, inputValue, setInputValue);
    },
    [controller, inputValue],
  );

  const handleSuggestionSelect = useCallback(
    async (value: string) => {
      await controller.submit({ value, viaSuggestion: true });
    },
    [controller],
  );

  return (
    <form className="formfill-chat__composer" onSubmit={handleSubmit} autoComplete="off">
      {showSuggestions && state.currentField?.options ? (
        <SuggestionsComponent
          suggestions={state.currentField.options}
          onSelect={handleSuggestionSelect}
          disabled={isDisabled}
          className="formfill-chat__suggestions"
        />
      ) : null}
      <label className="formfill-chat__composer-label" htmlFor="formfill-chat-input">
        Reply
      </label>
      <textarea
        id="formfill-chat-input"
        ref={textareaRef}
        className="formfill-chat__composer-input"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder={state.currentField?.text ?? "Type your response"}
      />
      <div className="formfill-chat__composer-footer">
        <span className="formfill-chat__status-text">
          {isConversationComplete
            ? "Conversation completed"
            : state.isPending
            ? "Sending…"
            : ""}
        </span>
        <button
          type="submit"
          className="formfill-chat__composer-submit"
          disabled={isDisabled}
        >
          Send
        </button>
      </div>
    </form>
  );
}

function submitFromComposer(
  controller: ConversationController,
  value: string,
  setValue: (next: string) => void,
) {
  if (!value.trim()) {
    return;
  }
  void controller.submit({ value }).then((success) => {
    if (success) {
      setValue("");
    }
  });
}

function DefaultMessage({ message, className }: { message: ConversationMessage; className?: string }) {
  return <span className={className}>{message.text}</span>;
}

function DefaultSuggestions({
  suggestions,
  onSelect,
  disabled,
  className,
}: {
  suggestions: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className ?? "formfill-chat__suggestions-list"}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="formfill-chat__suggestion"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="formfill-chat__typing-indicator" aria-label="Typing">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </span>
  );
}

function messageClassName(message: ConversationMessage) {
  const base = "formfill-chat__message";
  if (message.role === "user") {
    return `${base} ${base}--user`;
  }
  if (message.role === "system") {
    return `${base} ${base}--system`;
  }
  return `${base} ${base}--bot`;
}

function buildThemeStyle(theme?: FormFillAppearanceConfig["theme"]) {
  if (!theme || Object.keys(theme).length === 0) {
    return undefined;
  }

  const style: CSSProperties = {};
  for (const [token, value] of Object.entries(theme)) {
    if (!value) {
      continue;
    }
    const cssVar = `--formfill-chat-${token.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    (style as Record<string, string>)[cssVar] = value;
  }
  return style;
}
