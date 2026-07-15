// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {RunwayFloorEnforcer} from "../src/RunwayFloorEnforcer.sol";
import {TestBase} from "./helpers/TestBase.sol";

contract RunwayFloorPolicyTest is TestBase {
    address internal constant USER = address(0xA11CE);
    RunwayFloorEnforcer internal enforcer;

    function setUp() public {
        enforcer = new RunwayFloorEnforcer(address(this));
    }

    function testRejectsFloorBelowProtocolReserve() public {
        uint256 requested = enforcer.PROTOCOL_RESERVE() - 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                RunwayFloorEnforcer.FloorBelowProtocolReserve.selector, requested, enforcer.PROTOCOL_RESERVE()
            )
        );
        vm.prank(USER);
        enforcer.setPolicy(requested);
    }

    function testSetsPolicyAtProtocolReserve() public {
        uint256 protocolReserve = enforcer.PROTOCOL_RESERVE();
        vm.prank(USER);
        uint256 nonce = enforcer.setPolicy(protocolReserve);

        (uint256 floor, uint256 storedNonce, bool enabled) = enforcer.policies(USER);
        assertEq(nonce, 1);
        assertEq(floor, protocolReserve);
        assertEq(storedNonce, 1);
        assertEq(enabled, true);
    }

    function testPolicyUpdateInvalidatesPreviousNonce() public {
        vm.prank(USER);
        enforcer.setPolicy(11 ether);
        vm.prank(USER);
        uint256 nonce = enforcer.setPolicy(12 ether);

        (uint256 floor, uint256 storedNonce, bool enabled) = enforcer.policies(USER);
        assertEq(nonce, 2);
        assertEq(floor, 12 ether);
        assertEq(storedNonce, 2);
        assertEq(enabled, true);
    }

    function testDisableIncrementsNonce() public {
        vm.prank(USER);
        enforcer.setPolicy(11 ether);
        vm.prank(USER);
        uint256 nonce = enforcer.disablePolicy();

        (uint256 floor, uint256 storedNonce, bool enabled) = enforcer.policies(USER);
        assertEq(nonce, 2);
        assertEq(floor, 11 ether);
        assertEq(storedNonce, 2);
        assertEq(enabled, false);
    }
}
