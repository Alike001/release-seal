# ReleaseSeal

**ReleaseSeal lets a builder prove that a specific Foundry build artifact matches the code currently deployed at a Monad address, then record that exact evidence onchain.**

It answers one narrow release question: _did this local build produce the runtime bytecode that is actually live at this contract address right now?_

## What a judge can verify in 30 seconds

1. Select **Verify ReleaseSeal itself** to load the genuine published registry artifact and run fresh Monad and Sourcify checks without a wallet.
2. ReleaseSeal displays a deterministic exact-match or mismatch result, with both hashes and byte counts.
3. For another release, choose a Foundry artifact JSON file and paste its deployed Monad Testnet contract address.
4. When the bytes match, connect a wallet to preflight and publish the same evidence through the live registry.
5. Open **Record** and load the first public testnet seal to see the stored evidence compared with a fresh live-code read.

The interface deliberately separates three different claims:

| Claim                 | What it means                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `EXACT RUNTIME MATCH` | The local artifact runtime bytes equal the code freshly read from the target address.                    |
| `SOURCE VERIFIED`     | Sourcify separately reports source-verification status for the target.                                   |
| `SEALED ONCHAIN`      | The ReleaseSeal registry accepted and stored the evidence after checking the target's `codehash` itself. |

## Live Monad Testnet proof

ReleaseSeal is connected to a live, ownerless registry on Monad Testnet (`10143`).

| Evidence                  | Value                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry                  | [`0x34e6115D585A22B176Cb4F664da389aB8cC8b7b4`](https://testnet.monadexplorer.com/address/0x34e6115D585A22B176Cb4F664da389aB8cC8b7b4)         |
| Registry deployment       | [`0xf3ba…f4bf1`](https://testnet.monadexplorer.com/tx/0xf3ba5d3b1dd25d37ca497ac59978e20c8f02b1d486bbcc529b53fa44346f4bf1) (block `45383155`) |
| Registry runtime hash     | `0xbeba792ad0de3adb3698cdfb49cb439a65736c88289f2e824edcc943f0407199`                                                                         |
| Example target (GasProbe) | [`0xDe7D3BA3A42643164378fa64B72dA5cBe9C9369c`](https://testnet.monadexplorer.com/address/0xDe7D3BA3A42643164378fa64B72dA5cBe9C9369c)         |
| Example runtime hash      | `0x90857816f72eedd2d66537f6c9ecf19a9e7eb4b8c697c14972a8f0ae0352ef30` (`1,407` bytes)                                                         |
| First public seal         | `0x53d2b1c05305211e12e191e76c95e3e88119a1d9b5d14c60131695940b31abec`                                                                         |
| First seal transaction    | [`0xf043…ef816`](https://testnet.monadexplorer.com/tx/0xf04316621c91c6292a8e6f6149d9d5ad38e274efd637a72f2b30bc53357ef816) (block `45389663`) |

The first seal records the GasProbe target above, its observed runtime hash, the selected artifact file hash, the deterministic release ID, and issuer `0x95A11471a92cF989b4f0a89330BcA619F887799E`.

## How it works

### Compare locally, read live code

The browser parses a Foundry artifact locally. It computes:

- the complete artifact file hash;
- the runtime hash from the artifact's deployed bytecode; and
- a release ID derived from that artifact hash.

It then makes a fresh Monad RPC read for the target's code. Matching runtime hashes and byte counts create a reproducible, visible comparison. No artifact is uploaded to a ReleaseSeal server.

### Seal onchain

`ReleaseSealRegistry` is a small ownerless Solidity registry. Before it records a seal, it rejects:

- a target address with no code;
- zero evidence values;
- a claimed runtime hash different from the target's current `EXTCODEHASH`; and
- a duplicate seal from the same issuer for the same exact evidence.

The seal ID is deterministically derived from the chain, registry, issuer, target, runtime hash, artifact hash, and release ID. The later **Record** view reads a seal without a wallet and compares its stored runtime hash against a newly fetched target code hash.

## Run locally

Requirements: Node.js `20.9+`, npm, and (for contract work) Foundry.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No environment variables or API keys are needed for the comparison flow.

Select **Verify ReleaseSeal itself** for the zero-setup live proof path. The bundled input is the genuine Foundry artifact that produced the deployed registry runtime; the result still comes from fresh Monad and Sourcify reads.

To use the example locally, select `contracts/out/GasProbe.sol/GasProbe.json` after compiling contracts, then enter:

```text
0xDe7D3BA3A42643164378fa64B72dA5cBe9C9369c
```

For the read-only proof path, open **Record** and select **Load first testnet seal**.

## Verification commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build

npm run contracts:fmt
npm run contracts:build
npm run contracts:test
```

## Project structure

```text
src/components/        comparison, wallet gate, and record UI
src/lib/               artifact parsing, deterministic comparison, Sourcify, registry reads
contracts/src/         ReleaseSealRegistry Solidity contract
contracts/test/        deterministic contract tests and fuzz coverage
contracts/script/      Monad Testnet deployment script
```

## Important boundaries

ReleaseSeal is release evidence, not a security audit or a safety verdict.

- A runtime match does **not** mean the contract is safe, correct, or approved.
- Artifact file hashes and release IDs are issuer-submitted provenance data; the registry independently verifies only the target's live runtime hash at sealing time.
- `SOURCE VERIFIED` is a separate third-party Sourcify result, not a claim made by the registry.
- A target contract can change after a seal is recorded. The Record view therefore performs a fresh code read and reports whether the current code still matches the stored runtime hash.
- The deployed registry and example seal are on Monad **Testnet**, not mainnet.
