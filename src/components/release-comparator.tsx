"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { getAddress, isAddress, type Address } from "viem";

import {
  ComparisonRow,
  type ComparisonMarkState,
} from "@/components/comparison-row";
import { EvidenceDrawer, RpcErrorDrawer } from "@/components/evidence-drawer";
import { SealRecordLookup } from "@/components/seal-record-lookup";
import { parseFoundryArtifact } from "@/lib/artifact";
import { monadChain, publicClient } from "@/lib/chain";
import { compareRuntime } from "@/lib/comparison";
import type {
  ArtifactEvidence,
  LiveComparison,
  SourcifyEvidence,
} from "@/lib/release-seal-types";
import { loadSelfCheckArtifact, selfCheckTarget } from "@/lib/self-check";
import { fetchSourcifyEvidence, unavailableEvidence } from "@/lib/sourcify";

type ComparisonState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "complete"; value: LiveComparison }
  | { status: "rpc-error"; source: SourcifyEvidence };

function display(value: string | number | undefined) {
  return value === undefined || value === "" ? "NOT PROVIDED" : value;
}

function sourceLabel(source: SourcifyEvidence | undefined) {
  if (!source) return "NOT CHECKED";
  if (source.state === "verified") return "SOURCE VERIFIED";
  if (source.state === "not-verified") return "SOURCE NOT VERIFIED";
  return "SOURCE CHECK UNAVAILABLE";
}

function runtimeMark(state: ComparisonState): ComparisonMarkState {
  if (state.status === "checking") return "checking";
  if (state.status === "rpc-error") return "not-available";
  if (state.status !== "complete") return "not-checked";
  if (state.value.runtime.outcome === "exact") return "exact";
  if (state.value.runtime.outcome === "differs") return "differs";
  return "not-available";
}

function runtimeValue(state: ComparisonState) {
  if (state.status === "checking") return "READING LIVE CODE";
  if (state.status === "rpc-error") return "NOT AVAILABLE";
  if (state.status !== "complete") return "NOT CHECKED";
  return state.value.runtime.outcome === "no-code"
    ? "NOT AVAILABLE"
    : state.value.runtime.observedRuntimeHash;
}

function runtimeBytes(state: ComparisonState) {
  if (state.status === "checking") return "READING";
  if (state.status === "rpc-error") return "NOT AVAILABLE";
  if (state.status !== "complete") return "NOT CHECKED";
  return state.value.runtime.outcome === "no-code"
    ? "0 BYTES"
    : `${state.value.runtime.observedBytes.toLocaleString("en-US")} BYTES`;
}

function contractCode(state: ComparisonState) {
  if (state.status === "checking") return "READING CONTRACT CODE";
  if (state.status === "rpc-error") return "RPC READ FAILED";
  if (state.status !== "complete") return "NOT CHECKED";
  return state.value.runtime.outcome === "no-code"
    ? "NO CONTRACT CODE"
    : "RUNTIME PRESENT";
}

function revealResult() {
  window.requestAnimationFrame(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById("evidence")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  });
}

export function ReleaseComparator() {
  const requestSequence = useRef(0);
  const [artifact, setArtifact] = useState<ArtifactEvidence>();
  const [artifactStatus, setArtifactStatus] = useState<
    "idle" | "parsing" | "valid" | "invalid"
  >("idle");
  const [artifactError, setArtifactError] = useState<string>();
  const [addressText, setAddressText] = useState("");
  const [comparison, setComparison] = useState<ComparisonState>({
    status: "idle",
  });

  const addressIsValid = isAddress(addressText.trim());
  const canCompare = Boolean(artifact) && addressIsValid;
  const live = comparison.status === "complete" ? comparison.value : undefined;
  const source =
    comparison.status === "complete"
      ? comparison.value.source
      : comparison.status === "rpc-error"
        ? comparison.source
        : undefined;

  async function readArtifact(file: File | undefined) {
    if (!file) return;
    const request = ++requestSequence.current;
    setArtifact(undefined);
    setArtifactError(undefined);
    setArtifactStatus("parsing");
    setComparison({ status: "idle" });

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = parseFoundryArtifact(bytes, file.name);
      if (request !== requestSequence.current) return;
      if (!result.ok) {
        setArtifactStatus("invalid");
        setArtifactError(result.error.message);
        return;
      }
      setArtifact(result.value);
      setArtifactStatus("valid");
    } catch {
      if (request !== requestSequence.current) return;
      setArtifactStatus("invalid");
      setArtifactError("The browser could not read this local file.");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void readArtifact(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void readArtifact(event.dataTransfer.files[0]);
  }

  function onAddressChange(event: ChangeEvent<HTMLInputElement>) {
    requestSequence.current += 1;
    setAddressText(event.target.value);
    setComparison({ status: "idle" });
  }

  async function compareEvidence(
    expectedArtifact: ArtifactEvidence,
    address: Address,
    request: number,
  ) {
    setComparison({ status: "checking" });

    const [codeResult, sourceEvidence] = await Promise.all([
      publicClient
        .getCode({ address })
        .then((code) => ({ ok: true as const, code }))
        .catch(() => ({ ok: false as const })),
      fetchSourcifyEvidence(address),
    ]);

    if (request !== requestSequence.current) return;
    if (!codeResult.ok) {
      setComparison({
        status: "rpc-error",
        source: sourceEvidence ?? unavailableEvidence(),
      });
      revealResult();
      return;
    }

    setComparison({
      status: "complete",
      value: {
        address,
        runtime: compareRuntime(expectedArtifact.runtime, codeResult.code),
        source: sourceEvidence,
      },
    });
    revealResult();
  }

  async function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!artifact || !isAddress(addressText.trim())) return;

    const request = ++requestSequence.current;
    const address = getAddress(addressText.trim()) as Address;
    await compareEvidence(artifact, address, request);
  }

  async function verifyReleaseSeal() {
    const request = ++requestSequence.current;
    setArtifact(undefined);
    setArtifactError(undefined);
    setArtifactStatus("parsing");
    setAddressText(selfCheckTarget);
    setComparison({ status: "idle" });

    try {
      const selfCheckArtifact = await loadSelfCheckArtifact();
      if (request !== requestSequence.current) return;
      setArtifact(selfCheckArtifact);
      setArtifactStatus("valid");
      await compareEvidence(selfCheckArtifact, selfCheckTarget, request);
    } catch (error) {
      if (request !== requestSequence.current) return;
      setArtifactStatus("invalid");
      setArtifactError(
        error instanceof Error
          ? error.message
          : "ReleaseSeal's published artifact could not be loaded.",
      );
    }
  }

  const evidenceState: ComparisonMarkState =
    comparison.status === "checking" ? "checking" : "evidence";

  return (
    <main className="release-shell">
      <header className="command-bar">
        <a
          className="release-wordmark"
          href="#compare"
          aria-label="ReleaseSeal"
        >
          [release] = [seal]
        </a>
        <span className="network-state">
          {monadChain.name.toUpperCase()} · LIVE RPC
        </span>
        <nav aria-label="ReleaseSeal utility navigation">
          <a href="#record">RECORD</a>
          <details className="about-menu">
            <summary>ABOUT</summary>
            <div>
              <strong>COMPARE RELEASE IDENTITY</strong>
              <p>
                Your artifact stays in this browser. ReleaseSeal compares its
                complete runtime with live Monad code. A match is not a safety
                or audit verdict.
              </p>
            </div>
          </details>
        </nav>
      </header>

      <form
        className="comparator"
        id="compare"
        onSubmit={compare}
        aria-busy={comparison.status === "checking"}
      >
        <section className="purpose-band" aria-labelledby="purpose-heading">
          <div className="purpose-copy">
            <h1 id="purpose-heading">
              Prove that the build on your computer is the code live on Monad.
            </h1>
            <p>
              Compare a Foundry artifact with fresh runtime bytecode, then
              record the exact match onchain.
            </p>
          </div>
          <div className="self-check-band">
            <button
              type="button"
              onClick={() => void verifyReleaseSeal()}
              disabled={
                artifactStatus === "parsing" || comparison.status === "checking"
              }
              aria-describedby="self-check-detail"
            >
              {artifactStatus === "parsing" || comparison.status === "checking"
                ? "VERIFYING RELEASESEAL…"
                : "VERIFY RELEASESEAL ITSELF"}
            </button>
            <span id="self-check-detail">
              REAL PUBLISHED ARTIFACT · LIVE MONAD RPC · SOURCIFY
            </span>
          </div>
        </section>

        <section className="input-stage" aria-label="Release inputs">
          <div className="intake intake-local">
            <p className="plane-label">LOCAL BUILD</p>
            <h2>Choose the build you meant to release.</h2>
            <div
              className={`artifact-drop artifact-drop-${artifactStatus}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <input
                className="artifact-input"
                type="file"
                accept="application/json,.json"
                onChange={onFileChange}
                aria-describedby="artifact-help"
              />
              <span>
                {artifactStatus === "parsing"
                  ? "READING ARTIFACT…"
                  : artifact
                    ? artifact.filename
                    : "CHOOSE FOUNDRY ARTIFACT"}
              </span>
              <small id="artifact-help">LOCAL ONLY · JSON · MAX 5 MB</small>
            </div>
            {artifactError ? (
              <p className="input-error" role="alert">
                ARTIFACT NOT SUPPORTED — {artifactError}
              </p>
            ) : null}
          </div>

          <div className="comparison-intro" aria-hidden="true">
            <span>·</span>
            <small>COMPARE</small>
          </div>

          <div className="intake intake-chain">
            <p className="plane-label">LIVE ON MONAD</p>
            <h2>Read what is actually deployed now.</h2>
            <label className="address-field">
              <span>CONTRACT ADDRESS</span>
              <input
                value={addressText}
                onChange={onAddressChange}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={addressText.length > 0 && !addressIsValid}
              />
            </label>
            {addressText.length > 0 && !addressIsValid ? (
              <p className="input-error" role="alert">
                ENTER A COMPLETE EVM CONTRACT ADDRESS
              </p>
            ) : null}
          </div>
        </section>

        <div className="compare-action-row">
          <div className="compare-action-local" />
          <div className="compare-action-spine" />
          <div className="compare-action-chain" />
          <button
            className="compare-button"
            type="submit"
            disabled={!canCompare || comparison.status === "checking"}
          >
            {comparison.status === "checking"
              ? "COMPARING…"
              : "COMPARE RELEASE"}
          </button>
        </div>

        <section
          className="evidence-table"
          aria-label="Paired release evidence"
        >
          <ComparisonRow
            localLabel="FILE"
            localValue={display(artifact?.filename)}
            chainLabel="NETWORK"
            chainValue={`${monadChain.name} · ${monadChain.id}`}
            state={evidenceState}
          />
          <ComparisonRow
            localLabel="COMPILATION TARGET"
            localValue={display(artifact?.compilationTarget)}
            chainLabel="CONTRACT CODE"
            chainValue={contractCode(comparison)}
            state={evidenceState}
          />
          <ComparisonRow
            localLabel="COMPILER"
            localValue={display(artifact?.compilerVersion)}
            chainLabel="SOURCE STATUS"
            chainValue={sourceLabel(source)}
            state={evidenceState}
          />
          <ComparisonRow
            localLabel="EXPECTED RUNTIME HASH"
            localValue={display(artifact?.runtimeHash)}
            localDetail={artifact?.runtimeHash}
            chainLabel="OBSERVED RUNTIME HASH"
            chainValue={runtimeValue(comparison)}
            chainDetail={
              live?.runtime.outcome === "no-code"
                ? undefined
                : live?.runtime.observedRuntimeHash
            }
            state={runtimeMark(comparison)}
          />
          <ComparisonRow
            localLabel="RUNTIME BYTES"
            localValue={
              artifact
                ? `${artifact.runtimeBytes.toLocaleString("en-US")} BYTES`
                : "NOT PROVIDED"
            }
            chainLabel="RUNTIME BYTES"
            chainValue={runtimeBytes(comparison)}
            state={runtimeMark(comparison)}
          />
          <ComparisonRow
            localLabel="ARTIFACT FILE HASH"
            localValue={display(artifact?.artifactFileHash)}
            localDetail={artifact?.artifactFileHash}
            chainLabel="SOURCIFY MATCH ID"
            chainValue={display(source?.matchId ?? undefined)}
            state={evidenceState}
          />
        </section>
      </form>

      <div className="result-live-region" aria-live="polite">
        {comparison.status === "complete" && artifact ? (
          <EvidenceDrawer
            runtime={comparison.value.runtime}
            source={comparison.value.source}
            artifactFileHash={artifact.artifactFileHash}
            target={comparison.value.address}
          />
        ) : comparison.status === "rpc-error" ? (
          <RpcErrorDrawer source={comparison.source} />
        ) : null}
      </div>
      <SealRecordLookup />
    </main>
  );
}
