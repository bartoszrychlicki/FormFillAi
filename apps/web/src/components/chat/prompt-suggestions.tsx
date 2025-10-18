interface PromptSuggestionsProps {
  label?: string;
  suggestions: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function PromptSuggestions({
  label,
  suggestions,
  onSelect,
  disabled = false,
  className,
}: PromptSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  const containerClassName = [
    "rounded-md border border-slate-200 bg-white p-3 shadow-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName} aria-label={label ?? "Prompt suggestions"}>
      {label ? <p className="mb-2 text-xs font-medium uppercase text-slate-500">{label}</p> : null}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion}-${index}`}
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onSelect(suggestion)}
            disabled={disabled}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
