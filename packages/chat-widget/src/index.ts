export type { FormFillChatProps } from "./client/components/FormFillChat";
export { FormFillChat } from "./client/components/FormFillChat";
export type { FormFillApiConfig } from "./client/api/createConversationApiClient";
export { createConversationApiClient } from "./client/api/createConversationApiClient";

export type { FormFillProviderProps } from "./client/context/FormFillProvider";
export { FormFillProvider, useFormFillContext } from "./client/context/FormFillProvider";

export { useConversation } from "./client/hooks/useConversation";

export type {
  FormFillChatEvent,
  FormFillAppearanceConfig,
  FormFillBehaviorConfig,
  FormFillChatSlots,
  FormFillThemeTokens,
  ConversationController,
  ConversationState,
  ConversationMessage,
  ConversationSubmitInput,
  FormFillContextValue,
  SchemaSource,
} from "./client/types";

export type {
  CreateFormFillHandlerOptions,
  FormFillRequestHandler,
  SchemaProvider,
  WebhookConfig,
  ConversationResponder,
  FormFillRequestPayload,
  FormFillResponsePayload,
  StartConversationRequest,
  ContinueConversationRequest,
} from "./server/createFormFillHandler";
export { createFormFillHandler } from "./server/createFormFillHandler";

export type { OpenAIResponderOptions } from "./server/responders/openai";
export { createOpenAIResponder } from "./server/responders/openai";

export { createNextRoute } from "./server/nextRoute";
