"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BaseError,
  ContractFunctionRevertedError,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  useConnect,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { monadChain } from "@/lib/chain";
import { publicClient } from "@/lib/chain";
import {
  releaseSealRegistryAbi,
  releaseSealRegistryAddress,
} from "@/lib/release-seal-registry";
import { isFinalizedSealBlock } from "@/lib/seal-record";

const subscribeToHydration = () => () => undefined;

function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function errorMessage(error: Error | null | undefined) {
  return (error as BaseError | undefined)?.shortMessage ?? error?.message;
}

function simulationFailure(error: Error | null | undefined) {
  if (!(error instanceof BaseError)) return undefined;
  const revertError = error.walk(
    (entry) => entry instanceof ContractFunctionRevertedError,
  );
  if (!(revertError instanceof ContractFunctionRevertedError)) {
    return undefined;
  }

  if (revertError.data?.errorName === "DuplicateSeal") {
    const sealId = revertError.data.args?.[0];
    return typeof sealId === "string" && sealId.startsWith("0x")
      ? { kind: "duplicate" as const, sealId }
      : { kind: "duplicate" as const };
  }
  if (revertError.data?.errorName === "RuntimeHashMismatch") {
    return { kind: "runtime-mismatch" as const };
  }
  if (revertError.data?.errorName === "TargetHasNoCode") {
    return { kind: "no-code" as const };
  }
  if (revertError.data?.errorName === "ZeroEvidence") {
    return { kind: "zero-evidence" as const };
  }
  return undefined;
}

export function WalletSealGate({
  publishEligible,
  target,
  runtimeHash,
  artifactFileHash,
  releaseId,
}: {
  publishEligible: boolean;
  target: Address;
  runtimeHash: Hex;
  artifactFileHash: Hex;
  releaseId: Hex;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { address, chainId, isConnected } = useAccount();
  const {
    connect,
    connectors,
    error: connectError,
    isPending: isConnecting,
  } = useConnect();
  const {
    switchChain,
    error: switchError,
    isPending: isSwitching,
  } = useSwitchChain();
  const canSimulate =
    hydrated && publishEligible && isConnected && chainId === monadChain.id;
  const {
    data: simulatedSeal,
    error: simulationError,
    isPending: isSimulating,
    refetch: simulateSeal,
  } = useSimulateContract({
    address: releaseSealRegistryAddress,
    abi: releaseSealRegistryAbi,
    functionName: "seal",
    args: [target, runtimeHash, artifactFileHash, releaseId],
    account: address,
    query: { enabled: canSimulate },
  });
  const {
    data: transactionHash,
    error: writeError,
    isPending: isSigning,
    writeContract,
  } = useWriteContract();
  const {
    data: receipt,
    error: receiptError,
    isLoading: isConfirming,
    isSuccess: hasReceipt,
  } = useWaitForTransactionReceipt({ hash: transactionHash });
  const [publicationState, setPublicationState] = useState<
    "idle" | "finalized" | "finality-error"
  >("idle");
  const [finalityError, setFinalityError] = useState<string>();
  const [finalityAttempt, setFinalityAttempt] = useState(0);
  const preflightFailure = simulationFailure(simulationError);

  useEffect(() => {
    if (!hasReceipt || !receipt || !simulatedSeal?.result) return;

    const receiptBlockNumber = receipt.blockNumber;
    const sealId = simulatedSeal.result;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function checkFinality() {
      try {
        const finalizedBlock = await publicClient.getBlock({
          blockTag: "finalized",
        });
        if (cancelled) return;

        if (isFinalizedSealBlock(receiptBlockNumber, finalizedBlock.number)) {
          setPublicationState("finalized");
          router.push(`/seal/${sealId}`);
          return;
        }

        timeout = setTimeout(() => void checkFinality(), 450);
      } catch (error) {
        if (cancelled) return;
        setPublicationState("finality-error");
        setFinalityError(errorMessage(error as Error));
      }
    }

    void checkFinality();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [finalityAttempt, hasReceipt, receipt, router, simulatedSeal?.result]);

  const awaitingFinality = hasReceipt && publicationState === "idle";

  if (!publishEligible) {
    return (
      <>
        <button className="publish-button" type="button" disabled>
          PUBLISH SEAL
        </button>
        <p>
          Exact runtime equality and an exact Sourcify runtime match are both
          required before a seal can be published.
        </p>
      </>
    );
  }

  if (!hydrated) {
    return (
      <>
        <button className="publish-button" type="button" disabled>
          PUBLISH SEAL
        </button>
        <p>Checking the local wallet connection.</p>
      </>
    );
  }

  if (!isConnected) {
    const connector = connectors[0];

    return (
      <>
        <button
          className="publish-button publish-button-connect"
          type="button"
          disabled={!connector || isConnecting}
          onClick={() => connector && connect({ connector })}
        >
          {isConnecting ? "CONNECTING WALLET…" : "CONNECT WALLET"}
        </button>
        <p>
          Connect an injected wallet to prepare this verified evidence for a
          Monad testnet seal. No transaction is requested here.
        </p>
        {connectError ? (
          <p className="wallet-error">{connectError.message}</p>
        ) : null}
      </>
    );
  }

  if (chainId !== monadChain.id) {
    return (
      <>
        <button
          className="publish-button publish-button-connect"
          type="button"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: monadChain.id })}
        >
          {isSwitching ? "SWITCHING NETWORK…" : "SWITCH TO MONAD TESTNET"}
        </button>
        <p>
          {address ? `${shortAddress(address)} is connected. ` : ""}A seal can
          only be prepared on Monad testnet (chain {monadChain.id}). No
          transaction is requested here.
        </p>
        {switchError ? (
          <p className="wallet-error">{switchError.message}</p>
        ) : null}
      </>
    );
  }

  return (
    <>
      <button
        className="publish-button publish-button-connect"
        type="button"
        disabled={isSimulating}
        onClick={() => void simulateSeal()}
      >
        {isSimulating ? "SIMULATING SEAL…" : "RECHECK SEAL PREFLIGHT"}
      </button>
      <p>
        {address ? `${shortAddress(address)} is on Monad testnet. ` : ""}The
        live registry call is simulated with this exact evidence before any
        signing path can be considered.
      </p>
      <p className="seal-id-note">
        RELEASE ID · <span>{releaseId}</span>
      </p>
      {simulatedSeal?.request ? (
        <>
          <p className="preflight-success">
            PREFLIGHT PASSED — the live registry accepted this exact request.
          </p>
          <button
            className="publish-button"
            type="button"
            disabled={isSigning || isConfirming || hasReceipt}
            onClick={() => writeContract(simulatedSeal.request)}
          >
            {isSigning
              ? "AWAITING WALLET…"
              : isConfirming
                ? "WAITING FOR RECEIPT…"
                : awaitingFinality
                  ? "WAITING FOR MONAD FINALITY…"
                  : publicationState === "finalized"
                    ? "OPENING PUBLIC RECORD…"
                    : "PUBLISH SEAL"}
          </button>
          <p>
            This opens your wallet with the simulated request only after you
            click. Publishing creates one public, permanent testnet seal.
          </p>
        </>
      ) : preflightFailure?.kind === "duplicate" ? (
        <p className="wallet-error">
          THIS EXACT RELEASE IS ALREADY SEALED BY THIS WALLET. A duplicate is
          rejected so one evidence tuple has one public record.{" "}
          {preflightFailure.sealId ? (
            <Link href={`/seal/${preflightFailure.sealId}`}>
              OPEN EXISTING RECORD
            </Link>
          ) : null}
        </p>
      ) : preflightFailure?.kind === "runtime-mismatch" ? (
        <p className="wallet-error">
          PREFLIGHT REJECTED — the target&apos;s current runtime changed before
          publication. Run the comparison again.
        </p>
      ) : preflightFailure?.kind === "no-code" ? (
        <p className="wallet-error">
          PREFLIGHT REJECTED — the target address has no contract code.
        </p>
      ) : preflightFailure?.kind === "zero-evidence" ? (
        <p className="wallet-error">
          PREFLIGHT REJECTED — one or more required evidence values are empty.
        </p>
      ) : simulationError ? (
        <p className="wallet-error">
          PREFLIGHT REVERTED — {simulationError.message}
        </p>
      ) : (
        <p>Preparing a no-signature simulation against the live registry.</p>
      )}
      {writeError ? (
        <p className="wallet-error">
          WALLET REQUEST FAILED — {errorMessage(writeError)}
        </p>
      ) : null}
      {transactionHash ? (
        <p className="transaction-evidence">
          SUBMITTED TX · <span>{transactionHash}</span>
        </p>
      ) : null}
      {receiptError ? (
        <p className="wallet-error">
          RECEIPT FAILED — {errorMessage(receiptError)}
        </p>
      ) : null}
      {hasReceipt && receipt && simulatedSeal?.result ? (
        <p className="transaction-success">
          INCLUDED IN BLOCK {receipt.blockNumber.toString()} —{" "}
          {awaitingFinality
            ? "waiting for Monad finality before the public record opens."
            : publicationState === "finalized"
              ? "finalized; opening the public record."
              : "receipt is available; finality check is starting."}
        </p>
      ) : null}
      {publicationState === "finality-error" ? (
        <div className="finality-retry">
          <p className="wallet-error">
            FINALITY CHECK UNAVAILABLE — {finalityError ?? "Try again shortly."}
          </p>
          <button
            className="finality-retry-button"
            type="button"
            onClick={() => {
              setFinalityError(undefined);
              setPublicationState("idle");
              setFinalityAttempt((attempt) => attempt + 1);
            }}
          >
            RETRY FINALITY CHECK
          </button>
        </div>
      ) : null}
    </>
  );
}
