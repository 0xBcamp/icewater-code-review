// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./MockERC20MintableBurnable_v3.sol";

// This will use a different base abstract contract that contains a new added
// variable in it with __gap updated.
contract MockH2OToken_v3 is MockERC20MintableBurnable_v3
{

    uint256 public newVar1;
    uint256 public newVar2;

    // todo allow to run only once
    function upgrade() public override onlyRole(DEFAULT_ADMIN_ROLE)
    {
        newMintableBurnableVar = 3;
    }

}
