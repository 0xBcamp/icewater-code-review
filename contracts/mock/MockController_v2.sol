// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../Controller.sol";

contract MockController_v2 is Controller
{
    uint256 public newVar1;

    // todo allow to run only once
    function upgrade() public onlyOwner
    {
        newVar1 = 1;
    }

}
