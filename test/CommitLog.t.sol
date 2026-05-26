// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/CommitLog.sol";

contract CommitLogTest is Test {
    CommitLog internal cl;

    function setUp() public {
        cl = new CommitLog();
    }

    function test_RecordCommitStoresAllFields() public {
        cl.recordDecision("tx-1", CommitLog.Decision.COMMIT, 50);

        (
            string memory id,
            CommitLog.Decision decision,
            uint256 ts,
            address coord,
            uint256 amount
        ) = cl.records("tx-1");

        assertEq(id, "tx-1");
        assertEq(uint8(decision), uint8(CommitLog.Decision.COMMIT));
        assertEq(ts, block.timestamp);
        assertEq(coord, address(this));
        assertEq(amount, 50);
    }

    function test_RecordAbortStoresAmount() public {
        cl.recordDecision("tx-2", CommitLog.Decision.ABORT, 150);
        (, CommitLog.Decision decision,,, uint256 amount) = cl.records("tx-2");
        assertEq(uint8(decision), uint8(CommitLog.Decision.ABORT));
        assertEq(amount, 150);
    }

    function test_RevertWhen_DoubleRecord() public {
        cl.recordDecision("tx-3", CommitLog.Decision.COMMIT, 10);
        vm.expectRevert(bytes("Decision already recorded"));
        cl.recordDecision("tx-3", CommitLog.Decision.ABORT, 10);
    }

    function test_RevertWhen_DecisionUnknown() public {
        vm.expectRevert(bytes("Invalid decision"));
        cl.recordDecision("tx-4", CommitLog.Decision.UNKNOWN, 10);
    }

    function test_GetDecisionReturnsStored() public {
        cl.recordDecision("tx-5", CommitLog.Decision.COMMIT, 1);
        assertEq(uint8(cl.getDecision("tx-5")), uint8(CommitLog.Decision.COMMIT));
    }
}
