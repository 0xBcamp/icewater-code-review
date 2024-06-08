// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../tokens/H2OToken.sol";

contract MockH2OToken_v4 is H2OToken
{
    int256 public newVar3; // this should override newVar1.
    uint256 public newVar2;

}
