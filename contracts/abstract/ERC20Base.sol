// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./ERCTokenBase.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/** @title Base contract for all ERC20 tokens in Icewater.
  */
abstract contract ERC20Base is ERC20Upgradeable, ERCTokenBase
{
    // Storage gap to allow adding new members in upgrades.
    uint256[20] private __gap;

    function __ERC20Base_init(
        string memory name,
        string memory symbol,
        address[] memory admins
    )
        internal onlyInitializing
    {
        __ERC20_init(name, symbol);
        __ERCTokenBase_init(admins);
    }

    /// @dev See {ERC20-decimals}.
    function decimals() public view virtual override returns (uint8)
    {
        return 18;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal virtual override whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}