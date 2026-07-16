"use client";

import { useSyncExternalStore } from "react";
import type { Address, Hex } from "viem";
import {
  type BaseError,
  useAccount,
  useConnect,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { monadChain } from "@/lib/chain";
import {
  releaseSealRegistryAbi,
  releaseSealRegistryAddress,
} from "@/lib/release-seal-registry";

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
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash: transactionHash });

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
            disabled={isSigning || isConfirming || isConfirmed}
            onClick={() => writeContract(simulatedSeal.request)}
          >
            {isSigning
              ? "AWAITING WALLET…"
              : isConfirming
                ? "WAITING FOR RECEIPT…"
                : isConfirmed
                  ? "SEAL RECORDED"
                  : "PUBLISH SEAL"}
          </button>
          <p>
            This opens your wallet with the simulated request only after you
            click. Publishing creates one public, permanent testnet seal.
          </p>
        </>
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
      {isConfirmed && receipt && simulatedSeal?.result ? (
        <p className="transaction-success">
          SEAL RECORDED · ID {simulatedSeal.result} · BLOCK{" "}
          {receipt.blockNumber.toString()}
        </p>
      ) : null}
    </>
  );
}
