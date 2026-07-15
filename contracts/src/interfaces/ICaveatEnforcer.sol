// SPDX-License-Identifier: MIT AND Apache-2.0
pragma solidity 0.8.23;

/// @dev ABI-compatible with MetaMask Delegation Framework v1.3.0.
type ModeCode is bytes32;

/// @notice Hooks invoked by DelegationManager around delegated execution.
interface ICaveatEnforcer {
    function beforeAllHook(
        bytes calldata terms,
        bytes calldata args,
        ModeCode mode,
        bytes calldata executionCalldata,
        bytes32 delegationHash,
        address delegator,
        address redeemer
    ) external;

    function beforeHook(
        bytes calldata terms,
        bytes calldata args,
        ModeCode mode,
        bytes calldata executionCalldata,
        bytes32 delegationHash,
        address delegator,
        address redeemer
    ) external;

    function afterHook(
        bytes calldata terms,
        bytes calldata args,
        ModeCode mode,
        bytes calldata executionCalldata,
        bytes32 delegationHash,
        address delegator,
        address redeemer
    ) external;

    function afterAllHook(
        bytes calldata terms,
        bytes calldata args,
        ModeCode mode,
        bytes calldata executionCalldata,
        bytes32 delegationHash,
        address delegator,
        address redeemer
    ) external;
}
