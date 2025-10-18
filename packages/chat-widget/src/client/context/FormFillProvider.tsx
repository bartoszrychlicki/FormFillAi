"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { FormFillContextValue } from "../types";

export interface FormFillProviderProps {
  value: FormFillContextValue;
  children: ReactNode;
}

const FormFillContext = createContext<FormFillContextValue | null>(null);

export function FormFillProvider({ value, children }: FormFillProviderProps) {
  const memoizedValue = useMemo(() => value, [value]);
  return <FormFillContext.Provider value={memoizedValue}>{children}</FormFillContext.Provider>;
}

export function useFormFillContext() {
  const context = useContext(FormFillContext);
  if (!context) {
    throw new Error("useFormFillContext must be used within a FormFillProvider.");
  }
  return context;
}
