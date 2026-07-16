import type { Address, Hex } from "viem";

import { CopyEvidence } from "@/components/copy-evidence";
import { WalletSealGate } from "@/components/wallet-seal-gate";
import { deriveReleaseId } from "@/lib/release-seal-registry";
import type {
  RuntimeComparison,
  SourcifyEvidence,
} from "@/lib/release-seal-types";

function sourceLabel(source: SourcifyEvidence) {
  if (source.state === "verified") return "SOURCE VERIFIED";
  if (source.state === "not-verified") return "SOURCE NOT VERIFIED";
  return "SOURCE CHECK UNAVAILABLE";
}

function resultHeading(runtime: RuntimeComparison) {
  if (runtime.outcome === "exact") return "The bytecode is identical.";
  if (runtime.outcome === "differs") {
    return "This artifact produces a different runtime.";
  }
  return "There is no contract code at this address.";
}

export function EvidenceDrawer({
  runtime,
  source,
  artifactFileHash,
  target,
  observedFinalizedBlock,
}: {
  runtime: RuntimeComparison;
  source: SourcifyEvidence;
  artifactFileHash: Hex;
  target: Address;
  observedFinalizedBlock: bigint;
}) {
  const exact = runtime.outcome === "exact";
  const publishEligible = exact && source.state === "verified";
  const releaseId = deriveReleaseId(artifactFileHash);

  return (
    <section
      className={`result-drawer result-drawer-${runtime.outcome}`}
      id="evidence"
      aria-labelledby="result-heading"
    >
      <div className="result-summary">
        <div>
          <p className="section-label">RESULT</p>
          <h2 id="result-heading" tabIndex={-1}>
            {resultHeading(runtime)}
          </h2>
        </div>
        <div className="result-statuses" aria-label="Independent result states">
          <span className={exact ? "status-exact" : "status-differs"}>
            {exact
              ? "= EXACT RUNTIME MATCH"
              : runtime.outcome === "differs"
                ? "≠ RUNTIME DIFFERS"
                : "— NO CONTRACT CODE"}
          </span>
          <span
            className={
              source.state === "verified"
                ? "status-exact"
                : source.state === "unavailable"
                  ? "status-neutral"
                  : "status-differs"
            }
          >
            {sourceLabel(source)}
          </span>
        </div>
      </div>

      <div className="result-evidence">
        <dl>
          <div>
            <dt>EXPECTED RUNTIME HASH</dt>
            <dd className="drawer-copy-value">
              <span>{runtime.expectedRuntimeHash}</span>
              <CopyEvidence value={runtime.expectedRuntimeHash} />
            </dd>
          </div>
          <div>
            <dt>OBSERVED RUNTIME HASH</dt>
            <dd className="drawer-copy-value">
              <span>
                {runtime.outcome === "no-code"
                  ? "NOT AVAILABLE"
                  : runtime.observedRuntimeHash}
              </span>
              {runtime.outcome === "no-code" ? null : (
                <CopyEvidence value={runtime.observedRuntimeHash} />
              )}
            </dd>
          </div>
          <div>
            <dt>BYTE COUNTS</dt>
            <dd>
              LOCAL {runtime.expectedBytes.toLocaleString("en-US")}
              {runtime.outcome === "no-code"
                ? " · ONCHAIN 0"
                : ` · ONCHAIN ${runtime.observedBytes.toLocaleString("en-US")}`}
            </dd>
          </div>
          <div>
            <dt>OBSERVED AT</dt>
            <dd>MONAD FINALIZED BLOCK {observedFinalizedBlock.toString()}</dd>
          </div>
          {runtime.outcome === "differs" ? (
            <div>
              <dt>FIRST DIFFERING BYTE</dt>
              <dd>{runtime.firstDifferenceOffset.toLocaleString("en-US")}</dd>
            </div>
          ) : null}
          <div>
            <dt>ARTIFACT FILE HASH</dt>
            <dd className="drawer-copy-value">
              <span>{artifactFileHash}</span>
              <CopyEvidence value={artifactFileHash} />
            </dd>
          </div>
          <div>
            <dt>RELEASE ID</dt>
            <dd className="drawer-copy-value">
              <span>{releaseId}</span>
              <CopyEvidence value={releaseId} />
            </dd>
          </div>
          <div>
            <dt>SOURCIFY</dt>
            <dd>{source.detail}</dd>
          </div>
        </dl>

        <div className="publish-panel">
          <WalletSealGate
            publishEligible={publishEligible}
            target={target}
            runtimeHash={runtime.expectedRuntimeHash}
            artifactFileHash={artifactFileHash}
            releaseId={releaseId}
          />
        </div>
      </div>

      {source.proxyDetected ? (
        <p className="proxy-warning">
          PROXY DETECTED — this comparison covers the target address&apos;s
          proxy runtime, not the implementation behind it.
        </p>
      ) : null}

      <p className="method-note" id="method">
        <strong>METHOD</strong> Keccak-256 of the complete deployed runtime
        bytecode read at the displayed finalized Monad block. Matching code is
        not a safety or audit verdict.
      </p>
    </section>
  );
}

export function RpcErrorDrawer({ source }: { source: SourcifyEvidence }) {
  return (
    <section
      className="result-drawer result-drawer-rpc-error"
      id="evidence"
      aria-labelledby="result-heading"
    >
      <div className="result-summary">
        <div>
          <p className="section-label">RESULT</p>
          <h2 id="result-heading" tabIndex={-1}>
            Monad could not be reached.
          </h2>
        </div>
        <div className="result-statuses">
          <span className="status-differs">RUNTIME NOT CHECKED</span>
          <span className="status-neutral">{sourceLabel(source)}</span>
        </div>
      </div>
      <p className="method-note" id="method">
        No runtime verdict was created. Check the network and run the same
        comparison again.
      </p>
    </section>
  );
}
