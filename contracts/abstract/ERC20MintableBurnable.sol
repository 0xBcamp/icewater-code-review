// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./ERC20Base.sol";

/** @title Base contract for all ERC20 tokens that can be minted/burned.
  */
abstract contract ERC20MintableBurnable is ERC20Base
{

    /// @dev AccessControl role that gives access to mint() and burn().
    bytes32 public constant MINTER_BURNER_ROLE = keccak256("MINTER_BURNER_ROLE");

    // Storage gap to allow adding new members in upgrades.
    uint256[20] private __gap;

    /// @notice Initializer. Call from within child contracts' initializers.
    function __ERC20MintableBurnable_init(
        string memory name,
        string memory symbol,
        address[] memory admins
    ) 
        internal onlyInitializing
    {
        __ERC20Base_init(name, symbol, admins);
    }

    /// @notice Mints `value` to the balance of `account`.
    /// @param account The address to add mint to.
    /// @param value The amount to mint.
    function mint(address account, uint256 value)
        external whenNotPaused onlyRole(MINTER_BURNER_ROLE)
    {
        _mint(account, value);
    }

    /// @notice Burns `value` from the balance of `account`.
    /// @param account The address to add burn.
    /// @param value The amount to burn.
    function burn(address account, uint256 value)
        external whenNotPaused onlyRole(MINTER_BURNER_ROLE)
    {
        _burn(account, value);
    }
}
