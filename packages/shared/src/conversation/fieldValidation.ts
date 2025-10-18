import { ConversationField } from "../schema/conversationSchema";

export type FieldValidationReason =
  | "required"
  | "type"
  | "format"
  | "option"
  | "unknown";

export interface FieldValidationFailure {
  success: false;
  reason: FieldValidationReason;
  message: string;
}

export interface FieldValidationSuccess<T = unknown> {
  success: true;
  value: T;
}

export type FieldValidationResult<T = unknown> =
  | FieldValidationFailure
  | FieldValidationSuccess<T>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const currencySymbols = ["$", "€", "£", "₤", "₣", "¥", "zł"];
const magnitudeMultipliers: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

const defaultFailureMessage = (field: ConversationField, fallback: string): string =>
  field.validation.failureMessage ?? fallback;

const normaliseToTrimmedString = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return null;
};

const stripCurrencySymbol = (value: string): string => {
  if (value.length === 0) {
    return value;
  }

  const first = value[0];
  if (currencySymbols.includes(first)) {
    return value.slice(1);
  }
  return value;
};

const parseNumericValue = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const normalised = stripCurrencySymbol(value).replace(/[,\s]/g, "").toLowerCase();
  const match = normalised.match(/^(-?\d+(?:\.\d+)?)([kmb])?$/i);
  if (!match) {
    return null;
  }

  const [, numericPart, magnitudeLetter] = match;
  const base = Number.parseFloat(numericPart);
  if (!Number.isFinite(base)) {
    return null;
  }

  if (!magnitudeLetter) {
    return base;
  }

  const multiplier = magnitudeMultipliers[magnitudeLetter.toLowerCase()];
  if (!multiplier) {
    return null;
  }

  return base * multiplier;
};

export const validateFieldValue = (
  field: ConversationField,
  rawValue: unknown,
): FieldValidationResult => {
  const trimmed = normaliseToTrimmedString(rawValue);

  if (field.validation.required && (!trimmed || trimmed.length === 0)) {
    return {
      success: false,
      reason: "required",
      message: defaultFailureMessage(
        field,
        "This answer is required. Please provide a response before we can continue.",
      ),
    };
  }

  switch (field.type) {
    case "text": {
      if (trimmed && trimmed.length > 0) {
        const minWords = field.validation.minWords;
        if (minWords) {
          const words = trimmed.split(/\s+/).filter(Boolean);
          if (words.length < minWords) {
            return {
              success: false,
              reason: "format",
              message: defaultFailureMessage(
                field,
                minWords === 1
                  ? "Please share a longer response so we can capture the full details."
                  : `Please include at least ${minWords} words so we capture the full response.`,
              ),
            };
          }
        }

        return { success: true, value: trimmed };
      }

      return {
        success: false,
        reason: "type",
        message: defaultFailureMessage(
          field,
          "Please provide a textual answer so we can progress with the intake.",
        ),
      };
    }
    case "email": {
      if (!trimmed) {
        return {
          success: false,
          reason: "required",
          message: defaultFailureMessage(
            field,
            "Please share the email address we should use to reach you.",
          ),
        };
      }

      if (emailPattern.test(trimmed)) {
        return { success: true, value: trimmed };
      }

      return {
        success: false,
        reason: "format",
        message: defaultFailureMessage(
          field,
          "That doesn't look like a valid email. Please use the format name@example.com.",
        ),
      };
    }
    case "number": {
      if (!trimmed) {
        return {
          success: false,
          reason: "required",
          message: defaultFailureMessage(
            field,
            "Please provide a numeric amount so we can keep going.",
          ),
        };
      }

      const parsed = parseNumericValue(trimmed);
      if (parsed !== null) {
        return { success: true, value: parsed };
      }

      return {
        success: false,
        reason: "format",
        message: defaultFailureMessage(
          field,
          "Please enter a number (you can use digits, optionally with k/m/b for thousands, millions, or billions).",
        ),
      };
    }
    case "select": {
      if (!trimmed) {
        return {
          success: false,
          reason: "required",
          message: defaultFailureMessage(
            field,
            "Please pick one of the available options to move forward.",
          ),
        };
      }

      const match = field.options?.find((option) => option === trimmed);
      if (match) {
        return { success: true, value: match };
      }

      return {
        success: false,
        reason: "option",
        message: defaultFailureMessage(
          field,
          "Please choose one of the suggested options.",
        ),
      };
    }
    default:
      return {
        success: false,
        reason: "unknown",
        message: defaultFailureMessage(field, "We couldn't validate this answer. Please try again."),
      };
  }
};
