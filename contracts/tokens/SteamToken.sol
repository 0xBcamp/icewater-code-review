// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../Constants.sol";
import "../abstract/ERC20Reward.sol";

/// @title STEAM Token Contract (Token for controlling stability).
contract SteamToken is ERC20Reward
{

    /// @notice Initializer
    /// @param admins Addresses that will be granted the DEFAULT_ADMIN_ROLE.
    /// @param holder Address that will hold the initial supply of this token.
    function initialize(address[] memory admins, address holder) 
        initializer public
    {
        __ERC20Reward_init(
            "STEAM", "STM", admins, D_DEFAULT_STM_REWARDS_DECAY_RATE);
        
        _mint(holder, D_INITIAL_STM_SUPPLY);
    }

}