"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { isHex, type Address, type Hex } from "viem";

import { CopyEvidence } from "@/components/copy-evidence";
import { parseFoundryArtifact } from "@/lib/artifact";
import { publicClient } from "@/lib/chain";
import {
  firstReleaseSealId,
  releaseSealRegistryAbi,
  releaseSealRegistryAddress,
  releaseSealedEvent,
} from "@/lib/release-seal-registry";
import type {
  ArtifactEvidence,
  SourcifyEvidence,
} from "@/lib/release-seal-types";
import {
  compareReproducedArtifact,
  compareSealedRuntime,
  isFinalizedSealBlock,
} from "@/lib/seal-record";
import { fetchSourcifyEvidence } from "@/lib/sourcify";

type SealRecord = {
  issuer: Address;
  target: Address;
  runtimeHash: Hex;
  artifactFileHash: Hex;
  releaseId: Hex;
  blockNumber: bigint;
};

type CompleteRecord = {
  sealId: Hex;
  record: SealRecord;
  transactionHash?: Hex;
  recordedAt?: bigint;
  finalizedBlock: bigint;
  liveRuntimeHash: Hex | undefined;
  runtimeState: "matches" | "changed";
  source: SourcifyEvidence;
};

type LookupState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "complete"; value: CompleteRecord }
  | { status: "invalid"; message: string }
  | { status: "not-found" }
  | { status: "error"; message: string };

type ReproductionState =
  | { status: "idle" }
  | { status: "reading" }
  | {
      status: "complete";
      artifact: ArtifactEvidence;
      fileMatches: boolean;
      runtimeMatches: boolean;
    }
  | { status: "error"; message: string };

function parseSealId(value: string) {
  const normalized = value.trim();
  return isHex(normalized, { strict: true }) && normalized.length === 66
    ? (normalized as Hex)
    : undefined;
}

function formatTimestamp(timestamp: bigint | undefined) {
  if (timestamp === undefined) return "NOT AVAILABLE";
  return new Date(Number(timestamp) * 1000).toISOString();
}

function explorerTransaction(transactionHash: Hex) {
  return `https://testnet.monadexplorer.com/tx/${transactionHash}`;
}

export function SealRecordLookup() {
  return <SealRecordSurface />;
}

export function SealRecordPage({ sealId }: { sealId: string }) {
  return <SealRecordSurface initialSealId={sealId} standalone />;
}

function SealRecordSurface({
  initialSealId,
  standalone = false,
}: {
  initialSealId?: string;
  standalone?: boolean;
}) {
  const initialId = parseSealId(initialSealId ?? "");
  const initialRead = useRef(false);
  const [sealIdText, setSealIdText] = useState(initialSealId ?? "");
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [reproduction, setReproduction] = useState<ReproductionState>({
    status: "idle",
  });

  const readSeal = useCallback(async (sealId: Hex) => {
    setState({ status: "reading" });
    setReproduction({ status: "idle" });

    try {
      const record = (await publicClient.readContract({
        address: releaseSealRegistryAddress,
        abi: releaseSealRegistryAbi,
        functionName: "getSeal",
        args: [sealId],
      })) as SealRecord;

      const sourcePromise = fetchSourcifyEvidence(record.target);
      const [sealedBlock, finalizedBlock, logs, source] = await Promise.all([
        publicClient.getBlock({ blockNumber: record.blockNumber }),
        publicClient.getBlock({ blockTag: "finalized" }),
        publicClient.getLogs({
          address: releaseSealRegistryAddress,
          event: releaseSealedEvent,
          args: { sealId },
          fromBlock: record.blockNumber,
          toBlock: record.blockNumber,
        }),
        sourcePromise,
      ]);
      const liveCode = await publicClient.getCode({
        address: record.target,
        blockNumber: finalizedBlock.number,
      });
      const runtime = compareSealedRuntime(record.runtimeHash, liveCode);

      setState({
        status: "complete",
        value: {
          sealId,
          record,
          transactionHash: logs[0]?.transactionHash,
          recordedAt: sealedBlock.timestamp,
          finalizedBlock: finalizedBlock.number,
          liveRuntimeHash: runtime.liveRuntimeHash,
          runtimeState: runtime.state,
          source,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown RPC error.";
      setState(
        message.includes("SealNotFound") || message.includes("reverted")
          ? { status: "not-found" }
          : { status: "error", message },
      );
    }
  }, []);

  useEffect(() => {
    if (!initialId || initialRead.current) return;
    initialRead.current = true;
    void readSeal(initialId);
  }, [initialId, readSeal]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sealId = parseSealId(sealIdText);
    if (!sealId) {
      setState({
        status: "invalid",
        message: "Enter a complete 32-byte seal ID beginning with 0x.",
      });
      return;
    }
    void readSeal(sealId);
  }

  function loadFirstSeal() {
    setSealIdText(firstReleaseSealId);
    void readSeal(firstReleaseSealId);
  }

  async function reproduceArtifact(file: File | undefined) {
    if (!file || state.status !== "complete") return;
    setReproduction({ status: "reading" });
    try {
      const artifactResult = parseFoundryArtifact(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
      );
      if (!artifactResult.ok) {
        setReproduction({
          status: "error",
          message: artifactResult.error.message,
        });
        return;
      }
      const result = compareReproducedArtifact(
        artifactResult.value,
        state.value.record.runtimeHash,
        state.value.record.artifactFileHash,
      );
      setReproduction({
        status: "complete",
        artifact: artifactResult.value,
        fileMatches: result.fileMatches,
        runtimeMatches: result.runtimeMatches,
      });
    } catch {
      setReproduction({
        status: "error",
        message: "The browser could not read this local artifact.",
      });
    }
  }

  const current = state.status === "complete" ? state.value : undefined;
  const finalityState = current
    ? isFinalizedSealBlock(current.record.blockNumber, current.finalizedBlock)
    : false;

  return (
    <main className={standalone ? "release-shell seal-page-shell" : undefined}>
      {standalone ? <RecordCommandBar /> : null}
      <section
        className="seal-record"
        id="record"
        aria-labelledby="record-heading"
      >
        <div className="seal-record-heading">
          <div>
            <p className="plane-label">
              {standalone ? "SHAREABLE ONCHAIN RECORD" : "ONCHAIN RECORD"}
            </p>
            <h2 id="record-heading">Read what the registry stored.</h2>
          </div>
          <p>
            The stored seal is read from Monad, then the target runtime and
            source evidence are refreshed at the current finalized block.
          </p>
        </div>

        <form className="seal-record-form" onSubmit={submit}>
          <label>
            SEAL ID
            <input
              value={sealIdText}
              onChange={(event) => setSealIdText(event.target.value)}
              placeholder="0x…"
              spellCheck="false"
              inputMode="text"
            />
          </label>
          <button type="submit" disabled={state.status === "reading"}>
            {state.status === "reading" ? "READING RECORD…" : "READ SEAL"}
          </button>
          {!standalone ? (
            <button
              type="button"
              onClick={loadFirstSeal}
              disabled={state.status === "reading"}
            >
              LOAD FIRST TESTNET SEAL
            </button>
          ) : null}
        </form>

        {state.status === "invalid" || state.status === "error" ? (
          <p className="record-error">{state.message}</p>
        ) : null}
        {state.status === "not-found" ? (
          <p className="record-error">
            NO STORED SEAL EXISTS FOR THAT IDENTIFIER.
          </p>
        ) : null}
        {current ? (
          <div className="seal-record-result">
            <div
              className={
                current.runtimeState === "matches"
                  ? "record-good"
                  : "record-bad"
              }
            >
              {current.runtimeState === "matches"
                ? "= CODE STILL MATCHES"
                : "≠ CODE CHANGED"}
            </div>
            <p className={finalityState ? "record-finalized" : "record-bad"}>
              {finalityState
                ? `FINALIZED ON MONAD · SEALED BLOCK ${current.record.blockNumber.toString()}`
                : "SEAL BLOCK IS NOT YET FINALIZED"}
            </p>
            <dl>
              <RecordRow label="SEAL ID" value={current.sealId} />
              <RecordRow
                label="EVENT TRANSACTION"
                value={current.transactionHash ?? "NOT AVAILABLE"}
                href={
                  current.transactionHash
                    ? explorerTransaction(current.transactionHash)
                    : undefined
                }
              />
              <RecordRow
                label="RECORDED AT"
                value={formatTimestamp(current.recordedAt)}
              />
              <RecordRow label="ISSUER" value={current.record.issuer} />
              <RecordRow label="TARGET" value={current.record.target} />
              <RecordRow
                label="SEALED BLOCK"
                value={current.record.blockNumber.toString()}
              />
              <RecordRow
                label="CURRENT FINALIZED BLOCK"
                value={current.finalizedBlock.toString()}
              />
              <RecordRow
                label="STORED RUNTIME HASH"
                value={current.record.runtimeHash}
              />
              <RecordRow
                label="CURRENT FINALIZED RUNTIME HASH"
                value={current.liveRuntimeHash ?? "NO CONTRACT CODE"}
              />
              <RecordRow
                label="ARTIFACT FILE HASH"
                value={current.record.artifactFileHash}
              />
              <RecordRow label="RELEASE ID" value={current.record.releaseId} />
              <RecordRow label="SOURCIFY" value={current.source.detail} />
              <RecordRow
                label="PROXY EVIDENCE"
                value={
                  current.source.proxyDetected
                    ? "PROXY DETECTED — the runtime comparison covers this proxy address, not its implementation."
                    : "NO PROXY INDICATOR FROM SOURCIFY"
                }
              />
            </dl>

            <div className="artifact-reproduction">
              <div>
                <p className="plane-label">ARTIFACT REPRODUCTION</p>
                <h3>Check the original local input again.</h3>
                <p>
                  Choose the Foundry artifact locally. ReleaseSeal compares both
                  its complete file hash and parsed runtime hash with the
                  evidence stored in this seal.
                </p>
              </div>
              <label className="reproduction-input">
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    void reproduceArtifact(event.target.files?.[0])
                  }
                />
                <span>
                  {reproduction.status === "reading"
                    ? "CHECKING ARTIFACT…"
                    : "CHOOSE ARTIFACT TO REPRODUCE"}
                </span>
                <small>LOCAL ONLY · JSON · MAX 5 MB</small>
              </label>
              {reproduction.status === "complete" ? (
                <div
                  className={
                    reproduction.fileMatches && reproduction.runtimeMatches
                      ? "reproduction-good"
                      : "reproduction-bad"
                  }
                >
                  <span>
                    FILE HASH {reproduction.fileMatches ? "MATCHES" : "DIFFERS"}
                  </span>
                  <span>
                    RUNTIME HASH{" "}
                    {reproduction.runtimeMatches ? "MATCHES" : "DIFFERS"}
                  </span>
                </div>
              ) : null}
              {reproduction.status === "error" ? (
                <p className="record-error">
                  ARTIFACT NOT SUPPORTED — {reproduction.message}
                </p>
              ) : null}
            </div>
            <p className="record-method">
              This record proves what the registry stored and compares the
              target code again at a displayed finalized Monad block. Artifact
              and release identifiers are issuer-provided provenance; a match is
              not a contract safety verdict.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function RecordCommandBar() {
  return (
    <header className="command-bar">
      <Link className="release-wordmark" href="/" aria-label="ReleaseSeal home">
        [release] = [seal]
      </Link>
      <span className="network-state">MONAD TESTNET · FINALIZED READS</span>
      <nav aria-label="ReleaseSeal utility navigation">
        <Link href="/">COMPARE</Link>
      </nav>
    </header>
  );
}

function RecordRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const copyable = value.startsWith("0x");
  return (
    <div>
      <dt>{label}</dt>
      <dd className="drawer-copy-value">
        {href ? (
          <a
            className="record-external-link"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {value}
          </a>
        ) : (
          <span>{value}</span>
        )}
        {copyable ? <CopyEvidence value={value} /> : null}
      </dd>
    </div>
  );
}
