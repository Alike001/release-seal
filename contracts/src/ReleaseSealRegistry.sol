// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title ReleaseSealRegistry
/// @notice Records a builder's release evidence only when the target's live runtime hash agrees.
/// @dev The registry proves the live code hash it observed. Artifact and release identifiers are
///      issuer-submitted evidence; they are not source audits or safety claims.
contract ReleaseSealRegistry {
    struct Seal {
        address issuer;
        address target;
        bytes32 runtimeHash;
        bytes32 artifactFileHash;
        bytes32 releaseId;
        uint64 blockNumber;
    }

    mapping(bytes32 sealId => Seal sealRecord) private seals;

    error DuplicateSeal(bytes32 sealId);
    error RuntimeHashMismatch(bytes32 claimed, bytes32 observed);
    error SealNotFound(bytes32 sealId);
    error TargetHasNoCode(address target);
    error ZeroEvidence();

    event ReleaseSealed(
        bytes32 indexed sealId,
        address indexed issuer,
        address indexed target,
        bytes32 runtimeHash,
        bytes32 artifactFileHash,
        bytes32 releaseId,
        uint64 blockNumber
    );

    /// @notice Records evidence for a release after re-reading the target's runtime code hash.
    function seal(address target, bytes32 claimedRuntimeHash, bytes32 artifactFileHash, bytes32 releaseId)
        external
        returns (bytes32 sealId)
    {
        if (claimedRuntimeHash == bytes32(0) || artifactFileHash == bytes32(0) || releaseId == bytes32(0)) {
            revert ZeroEvidence();
        }
        if (target.code.length == 0) revert TargetHasNoCode(target);

        bytes32 observedRuntimeHash = target.codehash;
        if (observedRuntimeHash != claimedRuntimeHash) {
            revert RuntimeHashMismatch(claimedRuntimeHash, observedRuntimeHash);
        }

        sealId = computeSealId(msg.sender, target, observedRuntimeHash, artifactFileHash, releaseId);
        if (seals[sealId].issuer != address(0)) revert DuplicateSeal(sealId);

        uint64 observedBlock = uint64(block.number);
        seals[sealId] = Seal({
            issuer: msg.sender,
            target: target,
            runtimeHash: observedRuntimeHash,
            artifactFileHash: artifactFileHash,
            releaseId: releaseId,
            blockNumber: observedBlock
        });

        emit ReleaseSealed(sealId, msg.sender, target, observedRuntimeHash, artifactFileHash, releaseId, observedBlock);
    }

    /// @notice Derives the identifier before publication without changing chain state.
    function computeSealId(
        address issuer,
        address target,
        bytes32 runtimeHash,
        bytes32 artifactFileHash,
        bytes32 releaseId
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(block.chainid, address(this), issuer, target, runtimeHash, artifactFileHash, releaseId)
        );
    }

    /// @notice Reads one known seal. Unknown identifiers revert instead of returning fake zero data.
    function getSeal(bytes32 sealId) external view returns (Seal memory sealRecord) {
        sealRecord = seals[sealId];
        if (sealRecord.issuer == address(0)) revert SealNotFound(sealId);
    }

    function sealExists(bytes32 sealId) external view returns (bool) {
        return seals[sealId].issuer != address(0);
    }
}
