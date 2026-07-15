"use client";

import {
  decodeEventLog,
  decodeFunctionData,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  useConnect,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  expectedProbeRuntimeHash,
  monadChain,
  monadRpcUrl,
  probeAddress,
  publicClient,
} from "@/lib/chain";
import { formatGas, formatMon, shortHash } from "@/lib/format";
import { calculateBilling } from "@/lib/evidence/calculate";
import { determineEvidenceState } from "@/lib/evidence/verify";
import { gasProbeAbi, maxIterations, type ProbeMeasurement } from "@/lib/probe";

type Verification = "checking" | "verified" | "mismatch" | "unavailable";
type RunState =
  | "ready"
  | "estimating"
  | "awaiting-signature"
  | "submitted"
  | "reading-receipt"
  | "waiting-finality"
  | "evidence-verified"
  | "cannot-verify"
  | "conflicting-evidence"
  | "reverted";

type CompletedRun = {
  hash: Hex;
  estimate: bigint;
  signedGas: bigint;
  receiptGas: bigint;
  fee: bigint | undefined;
  measurement: ProbeMeasurement | undefined;
  blockNumber: bigint;
  finalBlock: bigint;
  state: RunState;
};

function numberFromInput(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maxIterations
    ? parsed
    : undefined;
}

function useClientReady() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

export function GasMirror() {
  const {
    address: restoredAddress,
    chainId: restoredChainId,
    isConnected: restoredConnected,
  } = useAccount();
  const clientReady = useClientReady();
  const address = clientReady ? restoredAddress : undefined;
  const chainId = clientReady ? restoredChainId : undefined;
  const isConnected = clientReady && restoredConnected;
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: hash, writeContractAsync, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const [verification, setVerification] = useState<Verification>("checking");
  const [iterationsText, setIterationsText] = useState("32");
  const [gasMode, setGasMode] = useState<"wallet" | "custom">("wallet");
  const [customGasText, setCustomGasText] = useState("");
  const [estimate, setEstimate] = useState<bigint>();
  const [runId, setRunId] = useState<Hex>();
  const [state, setState] = useState<RunState>("ready");
  const [notice, setNotice] = useState(
    "Connect a wallet to prepare a live calibration.",
  );
  const [completedRun, setCompletedRun] = useState<CompletedRun>();
  const [finalityRefresh, setFinalityRefresh] = useState(0);

  const iterations = useMemo(
    () => numberFromInput(iterationsText),
    [iterationsText],
  );
  const requestedGas = useMemo(() => {
    if (gasMode === "wallet") return undefined;
    try {
      const value = BigInt(customGasText || "0");
      return value > 0n ? value : undefined;
    } catch {
      return undefined;
    }
  }, [customGasText, gasMode]);

  const onExpectedChain = chainId === monadChain.id;
  const canEstimate =
    Boolean(address) &&
    onExpectedChain &&
    verification === "verified" &&
    iterations !== undefined;
  const customGasIsValid =
    gasMode === "wallet" ||
    (requestedGas !== undefined &&
      estimate !== undefined &&
      requestedGas >= estimate);

  useEffect(() => {
    if (!receipt.data || state !== "waiting-finality") return;
    const interval = window.setInterval(() => {
      setFinalityRefresh((value) => value + 1);
    }, 4_000);
    return () => window.clearInterval(interval);
  }, [receipt.data, state]);

  useEffect(() => {
    let active = true;
    async function verifyProbe() {
      if (!probeAddress || !expectedProbeRuntimeHash) {
        if (active) setVerification("unavailable");
        return;
      }

      try {
        const code = await publicClient.getCode({ address: probeAddress });
        if (!code || code === "0x")
          throw new Error("No runtime code returned.");
        if (active) {
          setVerification(
            keccak256(code).toLowerCase() ===
              expectedProbeRuntimeHash.toLowerCase()
              ? "verified"
              : "mismatch",
          );
        }
      } catch {
        if (active) setVerification("unavailable");
      }
    }
    void verifyProbe();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function estimateCall() {
      if (!canEstimate || !address || iterations === undefined || !probeAddress)
        return;
      setState("estimating");
      setNotice("Reading a live RPC estimate for this exact zero-value call.");
      try {
        const nextRunId = keccak256(
          stringToHex(`${Date.now()}:${address}:${iterations}`),
        );
        const gas = await publicClient.estimateContractGas({
          address: probeAddress,
          abi: gasProbeAbi,
          functionName: "calibrate",
          args: [nextRunId, iterations],
          account: address,
        });
        if (active) {
          setRunId(nextRunId);
          setEstimate(gas);
          setState("ready");
          setNotice(
            "Live estimate ready. Review the call preview before signing.",
          );
        }
      } catch {
        if (active) {
          setEstimate(undefined);
          setState("ready");
          setNotice("CANNOT RUN: the RPC could not estimate this call.");
        }
      }
    }
    void estimateCall();
    return () => {
      active = false;
    };
  }, [address, canEstimate, iterations]);

  useEffect(() => {
    if (
      !receipt.data ||
      !hash ||
      !estimate ||
      !runId ||
      !probeAddress ||
      !address
    )
      return;
    const minedReceipt = receipt.data;
    const transactionHash = hash;
    const rpcEstimate = estimate;
    const calibrationRunId = runId;
    const contract = probeAddress;
    const caller = address;
    let active = true;
    async function resolveEvidence() {
      setState("reading-receipt");
      setNotice(
        "Reading signed transaction, receipt, probe event, and finality.",
      );
      try {
        const [transaction, finalized] = await Promise.all([
          publicClient.getTransaction({ hash: transactionHash }),
          publicClient.getBlock({ blockTag: "finalized" }),
        ]);
        const eventLog = minedReceipt.logs.find((log) => {
          if (log.address.toLowerCase() !== contract.toLowerCase())
            return false;
          try {
            return (
              decodeEventLog({
                abi: gasProbeAbi,
                data: log.data,
                topics: log.topics,
              }).eventName === "RunMeasured"
            );
          } catch {
            return false;
          }
        });
        const decodedEvent = eventLog
          ? decodeEventLog({
              abi: gasProbeAbi,
              data: eventLog.data,
              topics: eventLog.topics,
            })
          : undefined;
        const args = decodedEvent?.args as
          Partial<ProbeMeasurement> | undefined;
        const decodedCall = decodeFunctionData({
          abi: gasProbeAbi,
          data: transaction.input,
        });
        const measurement =
          args?.runId &&
          args.caller &&
          args.iterations !== undefined &&
          args.gasBeforeWork !== undefined &&
          args.gasAfterWork !== undefined &&
          args.checksum
            ? {
                runId: args.runId,
                caller: args.caller as Address,
                iterations: Number(args.iterations),
                gasBeforeWork: args.gasBeforeWork,
                gasAfterWork: args.gasAfterWork,
                checksum: args.checksum,
              }
            : undefined;
        const callArgs = decodedCall.args as readonly [Hex, number];
        const evidenceState = determineEvidenceState(
          {
            chainMatches: transaction.chainId === monadChain.id,
            codeHashMatches: verification === "verified",
            signedCallMatches:
              transaction.to?.toLowerCase() === contract.toLowerCase() &&
              decodedCall.functionName === "calibrate" &&
              callArgs[0]?.toLowerCase() === calibrationRunId.toLowerCase() &&
              Number(callArgs[1]) === iterations,
            receiptMatchesTransaction:
              minedReceipt.transactionHash === transactionHash,
            eventMatchesCall:
              measurement?.runId.toLowerCase() ===
                calibrationRunId.toLowerCase() &&
              measurement.caller.toLowerCase() === caller.toLowerCase() &&
              measurement.iterations === iterations,
            probeBoundaryIsValid:
              measurement !== undefined &&
              measurement.gasBeforeWork > measurement.gasAfterWork,
            transactionSucceeded: minedReceipt.status === "success",
            blockFinalized: minedReceipt.blockNumber <= finalized.number,
          },
          {
            rpcEstimateGas: rpcEstimate,
            signedGasLimit: transaction.gas,
            receiptGasUsed: minedReceipt.gasUsed,
            effectiveGasPrice: minedReceipt.effectiveGasPrice,
            probeWorkGas:
              measurement === undefined
                ? undefined
                : measurement.gasBeforeWork - measurement.gasAfterWork,
          },
        );
        if (!active) return;
        const finalState: RunState =
          evidenceState === "pending"
            ? "waiting-finality"
            : evidenceState === "replaced"
              ? "cannot-verify"
              : evidenceState;
        setCompletedRun({
          hash: transactionHash,
          estimate: rpcEstimate,
          signedGas: transaction.gas,
          receiptGas: minedReceipt.gasUsed,
          fee: minedReceipt.effectiveGasPrice,
          measurement,
          blockNumber: minedReceipt.blockNumber,
          finalBlock: finalized.number,
          state: finalState,
        });
        setState(finalState);
        setNotice(
          finalState === "evidence-verified"
            ? "EVIDENCE VERIFIED from the signed transaction, receipt, probe event, and finalized block."
            : finalState === "waiting-finality"
              ? "WAITING FOR FINALITY: receipt recorded; rechecking the finalized Monad block every 4 seconds."
              : `CANNOT VERIFY: ${finalState.replaceAll("-", " ")}.`,
        );
      } catch {
        if (active) {
          setState("cannot-verify");
          setNotice("CANNOT VERIFY: one or more live evidence reads failed.");
        }
      }
    }
    void resolveEvidence();
    return () => {
      active = false;
    };
  }, [
    address,
    estimate,
    finalityRefresh,
    hash,
    iterations,
    receipt.data,
    runId,
    verification,
  ]);

  async function runCalibration() {
    if (
      !address ||
      !probeAddress ||
      !runId ||
      iterations === undefined ||
      !customGasIsValid
    )
      return;
    try {
      setState("awaiting-signature");
      setNotice(
        "AWAITING SIGNATURE: review the exact zero-value call in your wallet.",
      );
      const submittedHash = await writeContractAsync({
        address: probeAddress,
        abi: gasProbeAbi,
        functionName: "calibrate",
        args: [runId, iterations],
        ...(requestedGas ? { gas: requestedGas } : {}),
      });
      setState("submitted");
      setNotice(
        `Submitted ${shortHash(submittedHash)}. Waiting for the receipt.`,
      );
    } catch {
      setState("ready");
      setNotice(
        "Wallet rejected or could not submit the calibration. No result was created.",
      );
    }
  }

  const billing = completedRun
    ? calculateBilling({
        rpcEstimateGas: completedRun.estimate,
        signedGasLimit: completedRun.signedGas,
        receiptGasUsed: completedRun.receiptGas,
        effectiveGasPrice: completedRun.fee,
        probeWorkGas:
          completedRun.measurement === undefined
            ? undefined
            : completedRun.measurement.gasBeforeWork -
              completedRun.measurement.gasAfterWork,
      })
    : undefined;

  return (
    <main className="shell">
      <aside className="rail" aria-label="Gas Mirror utility rail">
        <div className="wordmark" aria-label="Gas Mirror">
          <span>GAS</span>
          <i />
          <span>MIRROR</span>
        </div>
        <nav>
          <a className="active" href="#new-run">
            NEW RUN
          </a>
          <span>HISTORY</span>
          <span>COMPARE</span>
        </nav>
        <div className="rail-meta">
          <span>MONAD TESTNET · 10143</span>
          <span>{isConnected ? shortHash(address) : "CONNECT WALLET"}</span>
          <span>LIVE RPC</span>
        </div>
      </aside>
      <section className="document" id="new-run">
        <header className="run-header">
          <span>NEW CALIBRATION</span>
          <strong>
            {verification === "verified"
              ? "VERIFIED CONTRACT"
              : "CHECKING CONTRACT"}
          </strong>
        </header>
        <h1>Measure one real Monad calibration call.</h1>
        <p className="lede">
          Send a zero-value call to the verified probe and compare what your RPC
          estimated, what you authorized, what the probe measured, and what
          Monad billed.
        </p>

        <section className="method">
          <div className="stamp">01 METHOD</div>
          <p>
            <b>Bounded hash work.</b> The contract runs {maxIterations} or fewer
            deterministic hash iterations, measures only work inside its
            boundary, then emits the evidence event. It never receives value or
            holds funds.
          </p>
        </section>
        <section className="controls" aria-label="Calibration setup">
          <label>
            ITERATIONS
            <input
              value={iterationsText}
              inputMode="numeric"
              onChange={(event) => setIterationsText(event.target.value)}
              aria-describedby="iteration-help"
            />
          </label>
          <small id="iteration-help">
            Whole number from 0 to {maxIterations}. The live estimate changes
            with the selected work.
          </small>
          <fieldset>
            <legend>GAS LIMIT MODE</legend>
            <label>
              <input
                type="radio"
                checked={gasMode === "wallet"}
                onChange={() => setGasMode("wallet")}
              />{" "}
              USE WALLET DEFAULT
            </label>
            <label>
              <input
                type="radio"
                checked={gasMode === "custom"}
                onChange={() => setGasMode("custom")}
              />{" "}
              SET A LIMIT
            </label>
          </fieldset>
          {gasMode === "custom" && (
            <label>
              REQUESTED GAS
              <input
                value={customGasText}
                inputMode="numeric"
                onChange={(event) => setCustomGasText(event.target.value)}
              />
            </label>
          )}
        </section>

        <section className="preview">
          <div className="stamp">02 CALL PREVIEW</div>
          <dl>
            <div>
              <dt>RPC ESTIMATE</dt>
              <dd>{formatGas(estimate)} GAS</dd>
            </div>
            <div>
              <dt>CONTRACT</dt>
              <dd>{shortHash(probeAddress)}</dd>
            </div>
            <div>
              <dt>METHOD</dt>
              <dd>calibrate(bytes32,uint32)</dd>
            </div>
            <div>
              <dt>VALUE</dt>
              <dd>0 MON</dd>
            </div>
            <div>
              <dt>REQUESTED GAS</dt>
              <dd>
                {gasMode === "wallet"
                  ? "WALLET DEFAULT"
                  : formatGas(requestedGas)}
              </dd>
            </div>
            <div>
              <dt>RPC</dt>
              <dd>{monadRpcUrl}</dd>
            </div>
          </dl>
        </section>

        <p className="notice" aria-live="polite">
          {notice}
          {error ? ` ${error.message}` : ""}
        </p>
        {!isConnected ? (
          <button
            className="primary"
            onClick={() => connect({ connector: connectors[0] })}
            disabled={!connectors[0] || isConnecting}
          >
            {isConnecting ? "CONNECTING" : "CONNECT WALLET"}
          </button>
        ) : !onExpectedChain ? (
          <button
            className="primary"
            onClick={() => switchChain({ chainId: monadChain.id })}
            disabled={isSwitching}
          >
            {isSwitching ? "SWITCHING" : "SWITCH TO MONAD TESTNET"}
          </button>
        ) : (
          <button
            className="primary"
            onClick={() => void runCalibration()}
            disabled={
              !estimate ||
              !customGasIsValid ||
              verification !== "verified" ||
              state !== "ready"
            }
          >
            {state === "estimating"
              ? "ESTIMATING"
              : state === "awaiting-signature"
                ? "AWAITING SIGNATURE"
                : "RUN CALIBRATION"}
          </button>
        )}

        {completedRun && billing && (
          <section className="result">
            <div className="stamp">
              03 LIVE RESULT ·{" "}
              {completedRun.state.replaceAll("-", " ").toUpperCase()}
            </div>
            <div className="finding">
              <p>
                <span>RPC ESTIMATED</span>
                {formatGas(completedRun.estimate)} GAS
              </p>
              <p>
                <span>YOU AUTHORIZED</span>
                {formatGas(completedRun.signedGas)} GAS
              </p>
              <p>
                <span>PROBE MEASURED</span>
                {formatGas(
                  completedRun.measurement
                    ? completedRun.measurement.gasBeforeWork -
                        completedRun.measurement.gasAfterWork
                    : undefined,
                )}{" "}
                GAS <em>INSIDE THE CONTRACT</em>
              </p>
              <p>
                <span>MONAD BILLED</span>
                {formatMon(billing.billedFeeWei)}
              </p>
            </div>
            <p className="equation">
              SIGNED GAS LIMIT × EFFECTIVE GAS PRICE ={" "}
              {formatMon(billing.billedFeeWei)}
            </p>
            <details>
              <summary>SHOW EVIDENCE</summary>
              <dl>
                <div>
                  <dt>TRANSACTION</dt>
                  <dd>{completedRun.hash}</dd>
                </div>
                <div>
                  <dt>RECEIPT gasUsed</dt>
                  <dd>
                    {formatGas(completedRun.receiptGas)} GAS · billing
                    consistency field only
                  </dd>
                </div>
                <div>
                  <dt>FINALITY</dt>
                  <dd>
                    block {completedRun.blockNumber.toString()} ≤ finalized{" "}
                    {completedRun.finalBlock.toString()}
                  </dd>
                </div>
                <div>
                  <dt>PROBE EVENT</dt>
                  <dd>
                    {completedRun.measurement
                      ? `run ${shortHash(completedRun.measurement.runId)} · ${completedRun.measurement.iterations} iterations`
                      : "NOT PROVIDED"}
                  </dd>
                </div>
              </dl>
            </details>
          </section>
        )}
      </section>
    </main>
  );
}
