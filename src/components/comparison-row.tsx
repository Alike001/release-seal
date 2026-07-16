import type { ReactNode } from "react";

import { CopyEvidence } from "@/components/copy-evidence";

export type ComparisonMarkState =
  | "not-checked"
  | "checking"
  | "exact"
  | "differs"
  | "evidence"
  | "not-available";

const markCopy: Record<ComparisonMarkState, { symbol: string; label: string }> =
  {
    "not-checked": { symbol: "·", label: "NOT CHECKED" },
    checking: { symbol: "··", label: "CHECKING" },
    exact: { symbol: "=", label: "EXACT" },
    differs: { symbol: "≠", label: "DIFFERS" },
    evidence: { symbol: "—", label: "EVIDENCE" },
    "not-available": { symbol: "—", label: "NOT AVAILABLE" },
  };

function EvidenceCell({
  side,
  label,
  value,
  detail,
}: {
  side: "local" | "chain";
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className={`evidence-cell evidence-cell-${side}`}>
      <span className="evidence-label">{label}</span>
      <span className="evidence-value-wrap">
        <span className="evidence-value" title={detail}>
          {value}
        </span>
        {detail ? <CopyEvidence value={detail} /> : null}
      </span>
    </div>
  );
}

export function ComparisonRow({
  localLabel,
  localValue,
  localDetail,
  chainLabel,
  chainValue,
  chainDetail,
  state,
}: {
  localLabel: string;
  localValue: ReactNode;
  localDetail?: string;
  chainLabel: string;
  chainValue: ReactNode;
  chainDetail?: string;
  state: ComparisonMarkState;
}) {
  const copy = markCopy[state];

  return (
    <div className="evidence-row">
      <EvidenceCell
        side="local"
        label={localLabel}
        value={localValue}
        detail={localDetail}
      />
      <div
        className={`comparison-mark comparison-mark-${state}`}
        aria-label={copy.label}
      >
        <strong aria-hidden="true">{copy.symbol}</strong>
        <span>{copy.label}</span>
      </div>
      <EvidenceCell
        side="chain"
        label={chainLabel}
        value={chainValue}
        detail={chainDetail}
      />
    </div>
  );
}
