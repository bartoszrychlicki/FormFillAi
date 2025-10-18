interface TypingIndicatorProps {
  label?: string;
}

export function TypingIndicator({ label = "FormFillAI is typing..." }: TypingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      data-testid="typing-indicator"
      className="flex items-center gap-2"
    >
      <div className="flex items-center gap-1 rounded-md bg-white px-3 py-2 text-sm text-slate-600 shadow">
        <span className="sr-only">{label}</span>
        <span aria-hidden className="flex items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
        </span>
      </div>
    </div>
  );
}
