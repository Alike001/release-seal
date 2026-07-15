// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {GasProbe} from "../src/GasProbe.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploys GasProbe through the account selected by Forge's --account flag.
/// @dev Use an encrypted local keystore; do not provide a plaintext private key.
contract DeployGasProbe {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (GasProbe probe) {
        vm.startBroadcast();
        probe = new GasProbe();
        vm.stopBroadcast();
    }
}
