"use client";

import { useFormFillContext } from "../context/FormFillProvider";
import type { ConversationController } from "../types";

export function useConversation(): ConversationController {
  const context = useFormFillContext();
  return context.controller;
}
