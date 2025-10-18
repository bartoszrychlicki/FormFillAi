import type {
  ConversationFieldType,
  ConversationSchema,
} from "@formfillai/shared";
import type { ComponentType, CSSProperties, ReactNode } from "react";

export type FormFillChatEvent =
  | { type: "session-start"; sessionId: string }
  | { type: "session-complete"; sessionId: string; payload: unknown }
  | { type: "validation-error"; fieldId: string; message: string }
  | { type: "network-error"; message: string; retryable: boolean }
  | { type: "error"; message: string; cause?: unknown };

export interface FormFillThemeTokens {
  background: string;
  border: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  radius: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
}

export interface FormFillAppearanceConfig {
  className?: string;
  theme?: Partial<FormFillThemeTokens>;
  components?: Partial<FormFillChatSlots>;
}

export interface FormFillBehaviorConfig {
  onEvent?: (event: FormFillChatEvent) => void;
  retryPolicy?: RetryPolicy;
  autoFocus?: boolean;
}

export interface FormFillChatSlots {
  Container?: ComponentType<FormFillSlotRenderProps>;
  Header?: ComponentType<FormFillSlotRenderProps>;
  MessageList?: ComponentType<FormFillSlotRenderProps>;
  Message?: ComponentType<FormFillMessageSlotProps>;
  Composer?: ComponentType<FormFillSlotRenderProps>;
  Suggestions?: ComponentType<FormFillSuggestionSlotProps>;
}

export interface FormFillSlotRenderProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export interface FormFillMessageSlotProps {
  message: ConversationMessage;
  className?: string;
}

export interface FormFillSuggestionSlotProps {
  suggestions: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export type MessageRole = "bot" | "user" | "system";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt?: string;
}

export interface ConversationFieldState {
  id: string;
  text: string;
  type: ConversationFieldType;
  options?: string[];
  required?: boolean;
}

export interface ConversationState {
  status: "idle" | "loading" | "in_progress" | "completed" | "error";
  sessionId?: string;
  schema?: ConversationSchema;
  messages: ConversationMessage[];
  currentField: ConversationFieldState | null;
  isPending: boolean;
  error?: string | null;
}

export interface ConversationSubmitInput {
  value: string;
  viaSuggestion?: boolean;
}

export interface ConversationController {
  readonly state: ConversationState;
  start: () => Promise<void>;
  submit: (input: ConversationSubmitInput) => Promise<boolean>;
  reset: () => Promise<void>;
}

export interface FormFillContextValue {
  controller: ConversationController;
  behavior: FormFillBehaviorConfig;
  appearance: FormFillAppearanceConfig;
  schemaSource: SchemaSource;
}

export type SchemaSource =
  | { kind: "url"; url: string }
  | { kind: "loader"; loader: () => Promise<ConversationSchema> };
