// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @title GasProbe
/// @notice A stateless calibration target for bounded, repeatable contract work.
contract GasProbe {
    uint32 public constant MAX_ITERATIONS = 512;
    bytes32 public constant VERSION = keccak256("gas-mirror-probe/v1");

    error IterationsTooHigh(uint32 provided, uint32 maximum);

    event RunMeasured(
        bytes32 indexed runId,
        address indexed caller,
        uint32 iterations,
        uint256 gasBeforeWork,
        uint256 gasAfterWork,
        bytes32 checksum
    );

    /// @notice Runs a bounded deterministic workload and records its contract-side gas boundary.
    /// @dev The measurement excludes transaction intrinsic gas and the later event emission.
    function calibrate(bytes32 runId, uint32 iterations) external returns (uint256 workGas) {
        if (iterations > MAX_ITERATIONS) {
            revert IterationsTooHigh(iterations, MAX_ITERATIONS);
        }

        uint256 gasBeforeWork = gasleft();
        bytes32 checksum = keccak256(abi.encodePacked(runId, msg.sender, iterations));

        for (uint32 index; index < iterations;) {
            checksum = keccak256(abi.encodePacked(checksum, index));
            unchecked {
                ++index;
            }
        }

        uint256 gasAfterWork = gasleft();
        workGas = gasBeforeWork - gasAfterWork;

        emit RunMeasured(runId, msg.sender, iterations, gasBeforeWork, gasAfterWork, checksum);
    }
}
