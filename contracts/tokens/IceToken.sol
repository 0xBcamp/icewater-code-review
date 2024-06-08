// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../lib/FixedPoint.sol";
import "../Constants.sol";
import "../abstract/ERC20Reward.sol";

/// @title ICE Token Contract (Token for measuring stability).
/// Extends the {ERC20Reward} contract
contract IceToken is ERC20Reward {
    // Use Fixed Point library for decimal ints.
    using UFixedPoint for uint256;
    using SFixedPoint for int256;

    // Transfer tax
    uint256 public D_ICE_TRANSFER_TAX;
    bool public D_IS_ICE_TRANSFERABLE;

    /// @notice Initializer
    /// @param admins Addresses that will be granted the DEFAULT_ADMIN_ROLE.
    /// @param holder Address that will hold the initial supply of this token.
    function initialize(address[] memory admins, address holder) 
        initializer public
    {
        __ERC20Reward_init("ICE", "ICE", admins, 0);

        D_ICE_TRANSFER_TAX = D_DEFAULT_ICE_TRANSFER_TAX;
        D_IS_ICE_TRANSFERABLE = D_DEFAULT_IS_ICE_TRANSFERABLE;
        
        _mint(holder, D_INITIAL_ICE_SUPPLY);
    }

    /**
     * @notice Sets the transfer tax for ICE transfers.
     * @param dTransferTax_ The new transfer tax value.
     */
    function setTransferTax(uint256 dTransferTax_)
    {
        D_ICE_TRANSFER_TAX = dTransferTax_;
    }

    /**
     * @notice Sets the transferability of ICE.
     * @param isTransferable_ The new transferability value.
     */
    function setTransferable(bool isTransferable_)
        public onlyRole(DEFAULT_ADMIN_ROLE)
    {
        D_IS_ICE_TRANSFERABLE = isTransferable_;
    }

    /**
     * @notice Overrides the default ERC20 _beforeTokenTransfer hook to enforce transferability rules for ICE.
     * @param from The address the tokens are being transferred from.
     * @param to The address the tokens are being transferred to.
     * @param amount The amount of tokens being transferred.
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal virtual override whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
        require(D_IS_ICE_TRANSFERABLE || from == address(0) || to == address(0), "IceToken is non transferable.");
    }

    /// @notice Applies a transfer tax to ICE to prevent use of ICE as the stable token which could disrupt its measurement function.
    /// @param from The `from` account in a transfer/burn and 0 when minting.
    /// @param to The `to` account in a transfer/minting or 0 when burning.
    /// @param amount The token amount being transferred, minted or burned.
    function _afterTokenTransfer(address from, address to, uint256 amount
    )
        internal override
    {
        // Burn the tax on a transfer (currently from reciever balance)
        if (from != address(0) && to != address(0) && D_ICE_TRANSFER_TAX > 0) {
            uint256 burnAmount = D_ICE_TRANSFER_TAX.mul(amount);
            _burn(to, burnAmount);
        }
    }

}
