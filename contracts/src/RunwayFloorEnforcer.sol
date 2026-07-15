// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {ICaveatEnforcer, ModeCode} from "./interfaces/ICaveatEnforcer.sol";

/// @title RunwayFloorEnforcer
/// @notice Stores a user's MON floor and verifies it after delegated execution.
contract RunwayFloorEnforcer is ICaveatEnforcer {
    uint256 public constant PROTOCOL_RESERVE = 10 ether;

    struct Policy {
        uint256 floor;
        uint256 nonce;
        bool enabled;
    }

    address public immutable delegationManager;
    mapping(address user => Policy policy) public policies;

    error FloorBelowProtocolReserve(uint256 requested, uint256 minimum);
    error UnauthorizedHookCaller(address caller);
    error InvalidTermsLength(uint256 actual);
    error PolicyDisabled(address user);
    error PolicyNonceMismatch(uint256 expected, uint256 actual);
    error FloorBreached(uint256 endingBalance, uint256 floor);

    event PolicySet(address indexed user, uint256 floor, uint256 nonce);
    event PolicyDisabledEvent(address indexed user, uint256 nonce);
    event FloorVerified(
        bytes32 indexed delegationHash,
        address indexed user,
        address indexed redeemer,
        uint256 floor,
        uint256 endingBalance,
        uint256 policyNonce
    );

    constructor(address manager) {
        if (manager == address(0)) revert UnauthorizedHookCaller(address(0));
        delegationManager = manager;
    }

    modifier onlyDelegationManager() {
        if (msg.sender != delegationManager) {
            revert UnauthorizedHookCaller(msg.sender);
        }
        _;
    }

    function setPolicy(uint256 floor) external returns (uint256 nonce) {
        if (floor < PROTOCOL_RESERVE) {
            revert FloorBelowProtocolReserve(floor, PROTOCOL_RESERVE);
        }

        Policy storage policy = policies[msg.sender];
        nonce = policy.nonce + 1;
        policy.floor = floor;
        policy.nonce = nonce;
        policy.enabled = true;

        emit PolicySet(msg.sender, floor, nonce);
    }

    function disablePolicy() external returns (uint256 nonce) {
        Policy storage policy = policies[msg.sender];
        nonce = policy.nonce + 1;
        policy.nonce = nonce;
        policy.enabled = false;

        emit PolicyDisabledEvent(msg.sender, nonce);
    }

    function beforeAllHook(bytes calldata, bytes calldata, ModeCode, bytes calldata, bytes32, address, address)
        external
        view
        override
        onlyDelegationManager
    {}

    function beforeHook(bytes calldata, bytes calldata, ModeCode, bytes calldata, bytes32, address, address)
        external
        view
        override
        onlyDelegationManager
    {}

    function afterHook(bytes calldata, bytes calldata, ModeCode, bytes calldata, bytes32, address, address)
        external
        view
        override
        onlyDelegationManager
    {}

    function afterAllHook(
        bytes calldata terms,
        bytes calldata,
        ModeCode,
        bytes calldata,
        bytes32 delegationHash,
        address delegator,
        address redeemer
    ) external override onlyDelegationManager {
        if (terms.length != 32) revert InvalidTermsLength(terms.length);

        uint256 expectedNonce = abi.decode(terms, (uint256));
        Policy memory policy = policies[delegator];
        if (!policy.enabled) revert PolicyDisabled(delegator);
        if (policy.nonce != expectedNonce) {
            revert PolicyNonceMismatch(expectedNonce, policy.nonce);
        }

        uint256 endingBalance = delegator.balance;
        if (endingBalance < policy.floor) {
            revert FloorBreached(endingBalance, policy.floor);
        }

        emit FloorVerified(delegationHash, delegator, redeemer, policy.floor, endingBalance, policy.nonce);
    }
}
