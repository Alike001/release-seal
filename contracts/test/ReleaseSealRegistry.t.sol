// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {GasProbe} from "../src/GasProbe.sol";
import {ReleaseSealRegistry} from "../src/ReleaseSealRegistry.sol";

interface RegistryVm {
    function deal(address account, uint256 newBalance) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
}

contract ReleaseSealRegistryTest {
    RegistryVm internal constant vm = RegistryVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ReleaseSealRegistry internal registry;
    GasProbe internal target;

    bytes32 internal constant ARTIFACT_HASH = keccak256("artifact-file/v1");
    bytes32 internal constant RELEASE_ID = keccak256("release/v1");

    event ReleaseSealed(
        bytes32 indexed sealId,
        address indexed issuer,
        address indexed target,
        bytes32 runtimeHash,
        bytes32 artifactFileHash,
        bytes32 releaseId,
        uint64 blockNumber
    );

    function setUp() public {
        registry = new ReleaseSealRegistry();
        target = new GasProbe();
    }

    function test_sealStoresAndEmitsTheObservedRuntime() public {
        bytes32 runtimeHash = address(target).codehash;
        bytes32 expectedSealId =
            registry.computeSealId(address(this), address(target), runtimeHash, ARTIFACT_HASH, RELEASE_ID);

        vm.expectEmit(true, true, true, true);
        emit ReleaseSealed(
            expectedSealId, address(this), address(target), runtimeHash, ARTIFACT_HASH, RELEASE_ID, uint64(block.number)
        );

        bytes32 sealId = registry.seal(address(target), runtimeHash, ARTIFACT_HASH, RELEASE_ID);
        ReleaseSealRegistry.Seal memory stored = registry.getSeal(sealId);

        require(sealId == expectedSealId, "unexpected seal id");
        require(stored.issuer == address(this), "issuer not stored");
        require(stored.target == address(target), "target not stored");
        require(stored.runtimeHash == runtimeHash, "runtime not stored");
        require(stored.artifactFileHash == ARTIFACT_HASH, "artifact not stored");
        require(stored.releaseId == RELEASE_ID, "release not stored");
        require(stored.blockNumber == block.number, "block not stored");
        require(registry.sealExists(sealId), "seal should exist");
    }

    function test_sealRejectsTargetWithoutCode() public {
        address noCode = address(0xBEEF);

        vm.expectRevert(abi.encodeWithSelector(ReleaseSealRegistry.TargetHasNoCode.selector, noCode));
        registry.seal(noCode, keccak256("claimed"), ARTIFACT_HASH, RELEASE_ID);
    }

    function test_sealRejectsRuntimeMismatch() public {
        bytes32 claimed = keccak256("different-runtime");
        bytes32 observed = address(target).codehash;

        vm.expectRevert(abi.encodeWithSelector(ReleaseSealRegistry.RuntimeHashMismatch.selector, claimed, observed));
        registry.seal(address(target), claimed, ARTIFACT_HASH, RELEASE_ID);
    }

    function test_sealRejectsZeroEvidence() public {
        vm.expectRevert(ReleaseSealRegistry.ZeroEvidence.selector);
        registry.seal(address(target), address(target).codehash, bytes32(0), RELEASE_ID);
    }

    function test_sealRejectsDuplicateIdentifier() public {
        bytes32 runtimeHash = address(target).codehash;
        bytes32 sealId = registry.seal(address(target), runtimeHash, ARTIFACT_HASH, RELEASE_ID);

        vm.expectRevert(abi.encodeWithSelector(ReleaseSealRegistry.DuplicateSeal.selector, sealId));
        registry.seal(address(target), runtimeHash, ARTIFACT_HASH, RELEASE_ID);
    }

    function test_getSealRejectsUnknownIdentifier() public {
        bytes32 unknown = keccak256("unknown");

        vm.expectRevert(abi.encodeWithSelector(ReleaseSealRegistry.SealNotFound.selector, unknown));
        registry.getSeal(unknown);
    }

    function test_registryRejectsAccidentalMonTransfer() public {
        vm.deal(address(this), 1 ether);

        (bool success,) = address(registry).call{value: 1 wei}("");
        require(!success, "registry accepted MON");
        require(address(registry).balance == 0, "registry retained MON");
    }

    function test_changingAnyEvidenceChangesTheSealId() public view {
        bytes32 runtimeHash = address(target).codehash;
        bytes32 baseline =
            registry.computeSealId(address(this), address(target), runtimeHash, ARTIFACT_HASH, RELEASE_ID);

        require(
            baseline
                != registry.computeSealId(address(0xA11CE), address(target), runtimeHash, ARTIFACT_HASH, RELEASE_ID),
            "issuer did not change id"
        );
        require(
            baseline
                != registry.computeSealId(address(this), address(registry), runtimeHash, ARTIFACT_HASH, RELEASE_ID),
            "target did not change id"
        );
        require(
            baseline
                != registry.computeSealId(
                    address(this), address(target), keccak256("other"), ARTIFACT_HASH, RELEASE_ID
                ),
            "runtime did not change id"
        );
        require(
            baseline
                != registry.computeSealId(address(this), address(target), runtimeHash, keccak256("other"), RELEASE_ID),
            "artifact did not change id"
        );
        require(
            baseline
                != registry.computeSealId(
                    address(this), address(target), runtimeHash, ARTIFACT_HASH, keccak256("other")
                ),
            "release did not change id"
        );
    }

    function testFuzz_sealPreservesNonZeroIssuerEvidence(address issuer, bytes32 artifactHash, bytes32 releaseId)
        public
    {
        if (issuer == address(0)) issuer = address(1);
        if (artifactHash == bytes32(0)) artifactHash = bytes32(uint256(1));
        if (releaseId == bytes32(0)) releaseId = bytes32(uint256(1));
        bytes32 runtimeHash = address(target).codehash;

        vm.prank(issuer);
        bytes32 sealId = registry.seal(address(target), runtimeHash, artifactHash, releaseId);
        ReleaseSealRegistry.Seal memory stored = registry.getSeal(sealId);

        require(stored.issuer == issuer, "fuzz issuer mismatch");
        require(stored.artifactFileHash == artifactHash, "fuzz artifact mismatch");
        require(stored.releaseId == releaseId, "fuzz release mismatch");
        require(stored.runtimeHash == runtimeHash, "fuzz runtime mismatch");
    }
}
