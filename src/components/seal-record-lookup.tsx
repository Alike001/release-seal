"use client";

import { useState, type FormEvent } from "react";
import { isHex, type Address, type Hex } from "viem";

import { CopyEvidence } from "@/components/copy-evidence";
import { publicClient } from "@/lib/chain";
import {
  firstReleaseSealId,
  releaseSealRegistryAbi,
  releaseSealRegistryAddress,
} from "@/lib/release-seal-registry";
import { compareSealedRuntime } from "@/lib/seal-record";

type SealRecord = {
  issuer: Address;
  target: Address;
  runtimeHash: Hex;
  artifactFileHash: Hex;
  releaseId: Hex;
  blockNumber: bigint;
};

type LookupState =
  | { status: "idle" }
  | { status: "reading" }
  | {
      status: "complete";
      sealId: Hex;
      record: SealRecord;
      liveRuntimeHash: Hex | undefined;
      runtimeState: "matches" | "changed";
    }
  | { status: "invalid"; message: string }
  | { status: "not-found" }
  | { status: "error"; message: string };

function parseSealId(value: string) {
  const normalized = value.trim();
  return isHex(normalized, { strict: true }) && normalized.length === 66
    ? (normalized as Hex)
    : undefined;
}

export function SealRecordLookup() {
  const [sealIdText, setSealIdText] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });

  async function readSeal(sealId: Hex) {
    setState({ status: "reading" });

    try {
      const record = (await publicClient.readContract({
        address: releaseSealRegistryAddress,
        abi: releaseSealRegistryAbi,
        functionName: "getSeal",
        args: [sealId],
      })) as SealRecord;
      const liveCode = await publicClient.getCode({ address: record.target });
      const runtime = compareSealedRuntime(record.runtimeHash, liveCode);

      setState({
        status: "complete",
        sealId,
        record,
        liveRuntimeHash: runtime.liveRuntimeHash,
        runtimeState: runtime.state,
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
  }

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

  return (
    <section
      className="seal-record"
      id="record"
      aria-labelledby="record-heading"
    >
      <div className="seal-record-heading">
        <div>
          <p className="plane-label">ONCHAIN RECORD</p>
          <h2 id="record-heading">Read what the registry stored.</h2>
        </div>
        <p>
          This is a fresh Monad read. It checks the current target code against
          the runtime hash stored in the seal.
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
        <button
          type="button"
          onClick={loadFirstSeal}
          disabled={state.status === "reading"}
        >
          LOAD FIRST TESTNET SEAL
        </button>
      </form>

      {state.status === "invalid" || state.status === "error" ? (
        <p className="record-error">{state.message}</p>
      ) : null}
      {state.status === "not-found" ? (
        <p className="record-error">
          NO STORED SEAL EXISTS FOR THAT IDENTIFIER.
        </p>
      ) : null}
      {state.status === "complete" ? (
        <div className="seal-record-result">
          <div
            className={
              state.runtimeState === "matches" ? "record-good" : "record-bad"
            }
          >
            {state.runtimeState === "matches"
              ? "= CODE STILL MATCHES"
              : "≠ CODE CHANGED"}
          </div>
          <dl>
            <RecordRow label="SEAL ID" value={state.sealId} />
            <RecordRow label="ISSUER" value={state.record.issuer} />
            <RecordRow label="TARGET" value={state.record.target} />
            <RecordRow
              label="STORED RUNTIME HASH"
              value={state.record.runtimeHash}
            />
            <RecordRow
              label="CURRENT RUNTIME HASH"
              value={state.liveRuntimeHash ?? "NO CONTRACT CODE"}
            />
            <RecordRow
              label="ARTIFACT FILE HASH"
              value={state.record.artifactFileHash}
            />
            <RecordRow label="RELEASE ID" value={state.record.releaseId} />
            <RecordRow
              label="RECORDED BLOCK"
              value={state.record.blockNumber.toString()}
            />
          </dl>
          <p className="record-method">
            The registry stores issuer-submitted artifact/release identifiers
            and its observed runtime hash. This fresh check does not recover the
            original local file or prove contract safety.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function RecordRow({ label, value }: { label: string; value: string }) {
  const copyable = value.startsWith("0x");

  return (
    <div>
      <dt>{label}</dt>
      <dd className="drawer-copy-value">
        <span>{value}</span>
        {copyable ? <CopyEvidence value={value} /> : null}
      </dd>
    </div>
  );
}
