# ReleaseSeal

ReleaseSeal lets a builder compare a local Foundry artifact with a deployed Monad contract, then store the exact release evidence in an onchain registry. A later shareable record shows the original seal event and repeats the code comparison at a current finalized Monad block.

## The release question it answers

“Is the build I meant to release the code that is actually deployed?”

ReleaseSeal gives that question three separate, checkable answers:

| Evidence              | What it proves                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `EXACT RUNTIME MATCH` | The local artifact runtime bytecode equals the target runtime bytecode read at a displayed finalized Monad block.        |
| `SOURCE VERIFIED`     | Sourcify independently reports its source-verification result for the target.                                            |
| `SEALED ONCHAIN`      | The live registry read the target’s runtime hash itself and stored the supplied release evidence in a Monad transaction. |

An exact match is release evidence, **not** a security audit, an endorsement, or proof that the contract is safe.

## Try it

No environment variables or API keys are required for the read-only flow.

**Live demo:** [spark-pi-hazel.vercel.app](https://spark-pi-hazel.vercel.app)

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`, then choose **VERIFY RELEASESEAL ITSELF**. That loads the checked-in artifact for the deployed registry and performs fresh Monad and Sourcify reads. Your own artifact never leaves the browser.

To compare another release, choose a standard Foundry artifact JSON and enter the deployed Monad Testnet address. A wallet is only needed to publish a matching result.

## Publication and finality

ReleaseSeal does not call a transaction “final” just because a wallet receipt is available. After a transaction is included, the app waits until Monad reports a finalized block at or after the receipt block. It then opens `/seal/[id]`, the public record URL.

That record contains:

- the event transaction and recorded timestamp;
- issuer, target, release ID, artifact file hash, and stored runtime hash;
- the seal block and the block used for the current finalized code read;
- fresh Sourcify and proxy evidence; and
- an optional local artifact reproduction check that compares both the full artifact file hash and parsed runtime hash with the stored evidence.

## Live Monad Testnet evidence

| Evidence               | Value                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Network                | Monad Testnet (`10143`)                                                                                                              |
| Registry               | [`0x34e6115D585A22B176Cb4F664da389aB8cC8b7b4`](https://testnet.monadexplorer.com/address/0x34e6115D585A22B176Cb4F664da389aB8cC8b7b4) |
| Registry deployment    | [`0xf3ba…f4bf1`](https://testnet.monadexplorer.com/tx/0xf3ba5d3b1dd25d37ca497ac59978e20c8f02b1d486bbcc529b53fa44346f4bf1)            |
| Registry runtime hash  | `0xbeba792ad0de3adb3698cdfb49cb439a65736c88289f2e824edcc943f0407199`                                                                 |
| First public seal      | `0x53d2b1c05305211e12e191e76c95e3e88119a1d9b5d14c60131695940b31abec`                                                                 |
| First seal transaction | [`0xf043…ef816`](https://testnet.monadexplorer.com/tx/0xf04316621c91c6292a8e6f6149d9d5ad38e274efd637a72f2b30bc53357ef816)            |

## How it works

1. The browser parses a Foundry artifact locally and derives the full artifact-file hash, runtime hash, and deterministic release ID.
2. ReleaseSeal fetches the target bytecode at a specific Monad `finalized` block, then performs a byte-for-byte runtime comparison.
3. If runtime equality and Sourcify’s exact runtime match both hold, the wallet flow simulates the exact registry call before it can request a signature.
4. The ownerless `ReleaseSealRegistry` independently checks `target.codehash`, rejects mismatches and duplicate evidence, and emits the `ReleaseSealed` event.
5. The record route reads that event and stored seal back from Monad, then refreshes the target evidence at a new finalized block.

## Contract boundaries

The registry verifies the target’s live code hash at the moment it seals. It does **not** audit the source code or independently recover the original local artifact.

- Artifact file hashes and release IDs are issuer-supplied provenance values.
- Sourcify is a separate verification service; its result is displayed independently.
- If Sourcify detects a proxy, ReleaseSeal warns that the compared bytes are the proxy address’s runtime, not the implementation behind it.
- Code may change after a seal; the public record always performs a fresh finalized-block read.
- The registry and example seal are on Monad **Testnet**, not mainnet.

## Development and verification

Requirements: Node.js `20.9+`, npm, and Foundry for Solidity work.

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

GitHub Actions repeats those web and contract checks on pushes to `main` and pull requests.

## Repository layout

```text
src/components/       comparison, wallet publication, and shareable record UI
src/lib/              artifact parsing, deterministic comparison, RPC/Sourcify reads
src/app/seal/[sealId] public record route
contracts/src/        ReleaseSealRegistry Solidity contract
contracts/test/       contract test coverage
public/artifacts/     checked-in artifact used by the zero-setup self-check
```

Released under the [MIT License](LICENSE).
