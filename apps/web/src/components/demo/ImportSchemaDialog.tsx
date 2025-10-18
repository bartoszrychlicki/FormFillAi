"use client";

import { useState } from "react";

interface ImportSchemaDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportSchemaDialog({ isOpen, onClose }: ImportSchemaDialogProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<string | null>(null);

  const handleImport = async () => {
    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    setLoading(true);
    setError(null);
    setSchema(null);

    try {
      const response = await fetch("/api/import-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import form");
      }

      const data = await response.json();
      setSchema(JSON.stringify(data.schema, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (schema) {
      await navigator.clipboard.writeText(schema);
    }
  };

  const handleClose = () => {
    setUrl("");
    setError(null);
    setSchema(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Import Form from URL</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="form-url" className="block text-sm font-medium text-slate-700">
              Google Forms URL
            </label>
            <input
              id="form-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/forms/d/..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!schema && (
            <button
              onClick={handleImport}
              disabled={loading || !url.trim()}
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import Form"}
            </button>
          )}

          {schema && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="schema-output" className="block text-sm font-medium text-slate-700">
                  Generated Schema
                </label>
                <button
                  onClick={handleCopyToClipboard}
                  className="text-sm text-sky-600 hover:text-sky-700"
                >
                  Copy to Clipboard
                </button>
              </div>
              <textarea
                id="schema-output"
                value={schema}
                readOnly
                rows={20}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
              <div className="text-xs text-slate-500">
                Copy this schema and save it as a JSON file in <code className="rounded bg-slate-100 px-1 py-0.5">public/schemas/</code> to use it.
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
