// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../Constants.sol";
import "../abstract/ERC20MintableBurnable.sol";

/// @title H2O Token Contract (Stable Token).
/// @notice Extends the {ERC20MintableBurnable} contract.
contract H2OToken is ERC20MintableBurnable
{

    /// @notice Initializer
    /// @param admins Addresses that will be granted the DEFAULT_ADMIN_ROLE.
    /// @param holder Address that will hold the initial supply of this token.
    function initialize(address[] memory admins, address holder) 
        initializer public
    {
        __ERC20MintableBurnable_init("H2O", "H2O", admins);
        _mint(holder, D_INITIAL_H2O_SUPPLY);
    }

}
