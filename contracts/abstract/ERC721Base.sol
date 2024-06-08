// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./ERCTokenBase.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";

/** @title Base contract for all ERC721 tokens in Icewater.
  */
abstract contract ERC721Base is ERC721EnumerableUpgradeable, ERCTokenBase
{
    // Storage gap to allow adding new members in upgrades.
    uint256[20] private __gap;

    function __ERC721Base_init(
        string memory name,
        string memory symbol,
        address[] memory admins
    )
        internal onlyInitializing
    {
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __ERCTokenBase_init(admins);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal virtual override whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev See EIP-165: ERC-165 Standard Interface Detection
     * https://eips.ethereum.org/EIPS/eip-165
     **/
    function supportsInterface(bytes4 interfaceId)
        public virtual view
        override(ERC721EnumerableUpgradeable, ERCTokenBase)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}