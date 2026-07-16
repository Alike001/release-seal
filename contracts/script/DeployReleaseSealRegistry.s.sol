// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {ReleaseSealRegistry} from "../src/ReleaseSealRegistry.sol";

interface RegistryDeployVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploys the ownerless ReleaseSeal registry through Forge's selected account.
/// @dev This script is local-only until a separate testnet deployment approval is given.
contract DeployReleaseSealRegistry {
    RegistryDeployVm private constant vm = RegistryDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ReleaseSealRegistry registry) {
        vm.startBroadcast();
        registry = new ReleaseSealRegistry();
        vm.stopBroadcast();
    }
}
