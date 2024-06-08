// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../abstract/ERC20Base.sol";

// Abstract contract that upgrades from ERC20MintableBurnable, adding a new
// member variable in it.
abstract contract MockERC20MintableBurnable_v3 is ERC20Base
{
    // Same as ERC20MintableBurnable.
    bytes32 public constant MINTER_BURNER_ROLE = keccak256("MINTER_BURNER_ROLE");

    // Introduces a variable in a base abstract contract.
    uint256 public newMintableBurnableVar;

    // Removes one entry from the original gap of 20.
    uint256[19] private __gap;
}