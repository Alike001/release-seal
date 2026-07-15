// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {RunwayFloorEnforcer} from "../src/RunwayFloorEnforcer.sol";
import {ModeCode} from "../src/interfaces/ICaveatEnforcer.sol";
import {TestBase} from "./helpers/TestBase.sol";

contract RunwayFloorHookTest is TestBase {
    address internal constant USER = address(0xA11CE);
    address internal constant RELAYER = address(0xB0B);
    bytes32 internal constant DELEGATION_HASH = keccak256("runway-delegation");
    ModeCode internal constant MODE = ModeCode.wrap(bytes32(0));

    RunwayFloorEnforcer internal enforcer;

    function setUp() public {
        enforcer = new RunwayFloorEnforcer(address(this));
        vm.prank(USER);
        enforcer.setPolicy(11 ether);
    }

    function testPassesAtExactFloor() public {
        vm.deal(USER, 11 ether);

        vm.expectEmit(true, true, true, true);
        emit RunwayFloorEnforcer.FloorVerified(DELEGATION_HASH, USER, RELAYER, 11 ether, 11 ether, 1);
        _verify(abi.encode(uint256(1)));
    }

    function testRevertsOneWeiBelowFloor() public {
        vm.deal(USER, 11 ether - 1);
        vm.expectRevert(abi.encodeWithSelector(RunwayFloorEnforcer.FloorBreached.selector, 11 ether - 1, 11 ether));
        _verify(abi.encode(uint256(1)));
    }

    function testRejectsStalePolicyNonce() public {
        vm.prank(USER);
        enforcer.setPolicy(12 ether);
        vm.deal(USER, 12 ether);

        vm.expectRevert(abi.encodeWithSelector(RunwayFloorEnforcer.PolicyNonceMismatch.selector, 1, 2));
        _verify(abi.encode(uint256(1)));
    }

    function testRejectsDisabledPolicy() public {
        vm.prank(USER);
        enforcer.disablePolicy();

        vm.expectRevert(abi.encodeWithSelector(RunwayFloorEnforcer.PolicyDisabled.selector, USER));
        _verify(abi.encode(uint256(2)));
    }

    function testRejectsMalformedTerms() public {
        vm.expectRevert(abi.encodeWithSelector(RunwayFloorEnforcer.InvalidTermsLength.selector, 1));
        _verify(hex"01");
    }

    function testOnlyDelegationManagerCanCallHooks() public {
        vm.prank(RELAYER);
        vm.expectRevert(abi.encodeWithSelector(RunwayFloorEnforcer.UnauthorizedHookCaller.selector, RELAYER));
        enforcer.afterAllHook(abi.encode(uint256(1)), bytes(""), MODE, bytes(""), DELEGATION_HASH, USER, RELAYER);
    }

    function testFuzzSuccessfulVerificationNeverPassesBelowFloor(uint64 floorExtra, uint64 balanceExtra) public {
        uint256 floor = enforcer.PROTOCOL_RESERVE() + uint256(floorExtra);
        vm.prank(USER);
        enforcer.setPolicy(floor);
        vm.deal(USER, floor + uint256(balanceExtra));

        _verify(abi.encode(uint256(2)));

        (uint256 storedFloor,,) = enforcer.policies(USER);
        require(USER.balance >= storedFloor, "successful verification below floor");
    }

    function _verify(bytes memory terms) internal {
        enforcer.afterAllHook(terms, bytes(""), MODE, bytes(""), DELEGATION_HASH, USER, RELAYER);
    }
}
