"use client";

import { useState } from "react";

export function CopyEvidence({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="copy-evidence"
      type="button"
      onClick={copy}
      aria-label={`Copy ${value}`}
    >
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}
