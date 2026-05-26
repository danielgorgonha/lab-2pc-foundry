// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CommitLog.sol";

contract DeployCommitLog is Script {
    function run() external returns (CommitLog) {
        vm.startBroadcast();
        CommitLog commitLog = new CommitLog();
        vm.stopBroadcast();
        return commitLog;
    }
}
