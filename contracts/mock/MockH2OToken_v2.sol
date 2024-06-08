// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../tokens/H2OToken.sol";

contract MockH2OToken_v2 is H2OToken
{
    uint256 public newVar1;
    uint256 public newVar2;

    // todo allow to run only once
    function upgrade() public override onlyRole(DEFAULT_ADMIN_ROLE)
    {
        newVar1 = 1;
        newVar2 = 2;
    }

}
