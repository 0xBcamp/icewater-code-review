// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/** @title Base contract for all tokens (fungible & non fungible) in Icewater.
  */
abstract contract ERCTokenBase is
    AccessControlEnumerableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // To be used when upgrading child contracts.
    uint256[20] private __gap;

    /// @notice Initializer. Call from within child contracts' initializers.
    function __ERCTokenBase_init(address[] memory admins)
        internal onlyInitializing
    {
        __AccessControl_init();
        __AccessControlEnumerable_init();
        __Pausable_init();

        // Give the admin addresses the DEFAULT_ADMIN_ROLE
        for (uint i = 0; i < admins.length; ++i) {
            _setupRole(DEFAULT_ADMIN_ROLE, admins[i]);
        }
    }

    function _authorizeUpgrade(address)
        internal override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    // Extend in order to execute upgrade code.
    function upgrade() public virtual onlyRole(DEFAULT_ADMIN_ROLE) {}

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev See EIP-165: ERC-165 Standard Interface Detection
     * https://eips.ethereum.org/EIPS/eip-165
     **/
    function supportsInterface(bytes4 interfaceId)
        public virtual view
        override(AccessControlEnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

}