// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../Controller.sol";

contract MockETHRevertAttack
{
    Controller public victim;

    constructor (address payable _victim) {
        victim = Controller(_victim);
    }
    
    receive() external payable {
        if (msg.value > 0 && msg.value < 1e18) {
            revert();
        }
    }

    function submitBid() public {
        uint bidValue = 1e17;
        victim.initiatePositiveAuction{value: bidValue}();
    }

}
