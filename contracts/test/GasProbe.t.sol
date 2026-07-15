// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {GasProbe} from "../src/GasProbe.sol";

interface Vm {
    function prank(address sender) external;
    function expectRevert(bytes calldata revertData) external;
}

contract GasProbeTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    GasProbe internal probe;

    function setUp() public {
        probe = new GasProbe();
    }

    function test_calibrateMeasuresPositiveBoundedWork() public {
        uint256 workGas = probe.calibrate(keccak256("first-run"), 24);

        require(workGas > 0, "expected measured work");
        require(probe.VERSION() == keccak256("gas-mirror-probe/v1"), "unexpected version");
    }

    function testFuzz_calibrateAcceptsEveryBoundedIterationCount(uint32 iterations) public {
        iterations = uint32(uint256(iterations) % (uint256(probe.MAX_ITERATIONS()) + 1));
        address caller = address(0xA11CE);

        vm.prank(caller);
        uint256 workGas = probe.calibrate(bytes32(uint256(iterations)), iterations);

        require(workGas > 0, "expected measured work");
    }

    function test_calibrateRejectsIterationCountAboveLimit() public {
        uint32 invalidIterations = probe.MAX_ITERATIONS() + 1;

        vm.expectRevert(
            abi.encodeWithSelector(GasProbe.IterationsTooHigh.selector, invalidIterations, probe.MAX_ITERATIONS())
        );
        probe.calibrate(keccak256("too-many"), invalidIterations);
    }
}
