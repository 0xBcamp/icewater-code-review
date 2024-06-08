// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../lib/FixedPoint.sol";
import "./ERC20MintableBurnable.sol";

/// @title ERC20Reward Base Contract.
///
/// Extends the base {ERC20MintableBurnable} contract with the concept of rewards.
/// The reward amount is updated on every operation that changes the
/// balance of an account (transfer, mint and burn). It is calculated
/// by multiplying the total Token balance of the account with the elapsed
/// seconds since the last update (Token * seconds).
/// 
/// The available reward amount for an account can be claimed via
/// {claimReward()}. This amount is in Token * seconds since the last
/// claim.
///
/// @dev The transfer, mint and burn operations are intercepted via
///      the {_beforeTokenTransfer()} hook. This will call the {_reward()}
///      method to update the reward amount for both the `from` and `to`
///      accounts if they are not null.
abstract contract ERC20Reward is ERC20MintableBurnable
{
    
    // Use Fixed Point library for decimal ints.
    using UFixedPoint for uint256;
    
    /// @dev AccessControl role that gives access to mint() and burn().
    bytes32 public constant CLAIMER_ROLE = keccak256("CLAIMER_ROLE");

    // The timestamp of the last time the _Reward() function was called.
    mapping(address => uint256) private _iLastRewardTimes;

    // Stores the claimable reward per account.
    mapping(address => uint256) private _dClaimableReward;

    // The decay rate for the coin
    uint256 public D_REWARDS_DECAY_RATE;

    // Storage gap to allow adding new members in upgrades.
    uint256[20] private __gap;

    /// @notice Initializer. Call from within child contracts' initializers.
    function __ERC20Reward_init(
        string memory name,
        string memory symbol,
        address[] memory admins,
        uint256 dDecayRate
    ) 
        internal onlyInitializing
    {
        __ERC20MintableBurnable_init(name, symbol, admins);
        D_REWARDS_DECAY_RATE = dDecayRate;
    }

    /// @notice Updates the amount of claimable reward.
    /// @param account The address that's claiming reward.
    function _reward(address account) internal {
        if (_iLastRewardTimes[account] == 0) {
            // This is the first time this is called. Just set the last reward
            // time.
            _iLastRewardTimes[account] = block.timestamp;
            return;
        }

        // Update the unclaimed reward amount
        _dClaimableReward[account] = _calcClaimableReward(account);

        // Update the last reward time
        _iLastRewardTimes[account] = block.timestamp;

        // Emit a Reward event.
        emit Reward(account, _dClaimableReward[account]);
    }

    function _calcClaimableReward(address account) internal view returns (uint256) {
        uint256 iTimeSinceLastReward = block.timestamp - _iLastRewardTimes[account];
        uint256 dNewReward = iTimeSinceLastReward * balanceOf(account);
        uint256 dDecayAmount = iTimeSinceLastReward * _dClaimableReward[account].mul(D_REWARDS_DECAY_RATE);
        dDecayAmount = min(dDecayAmount, _dClaimableReward[account]);
        return _dClaimableReward[account] + dNewReward - dDecayAmount;
    }    

    /// @notice Determines how much total reward is unclaimed by the user
    /// @param account The address to determine the total reward for
    /// @return uint256 Amount of unclaimed reward for the address
    function claimableReward(address account)
        external view
        returns (uint256)
    {
        return _calcClaimableReward(account);
    }

    /// @notice Updates the reward of the accounts involved in a transfer/mint/burn.
    /// @param from The `from` account in a transfer/burn and 0 when minting.
    /// @param to The `to` account in a transfer/minting or 0 when burning.
    /// @param amount The token amount being transferred, minted or burned.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        // Uptate the `from` address reward if this is a transfer or burn.
        if (from != address(0) && amount > 0) {
            _reward(from);
        }
        
        // Uptate the `to` address reward if this is a transfer or mint.
        if (to != address(0) && amount > 0) {
            _reward(to);
        }
    }

    /// @notice Determines the current amount of claimable reward to be sent to the user and resets the claimable reward to zero.
    /// @param account The address for which the reward is being claimed and reset.
    /// @return uint256 The amount of claimable reward before the reset.
    function claimReward(address account)
        external whenNotPaused onlyRole(CLAIMER_ROLE)
        returns (uint256)
    {
        // Update the claimable reward.
        _reward(account);

        // Get the claimable reward to be returned.
        uint256 dClaimedAmount = _dClaimableReward[account];

        // Reset the claimable reward.
        _dClaimableReward[account] = 0;

        // Emit a ClaimReward event.
        emit ClaimReward(account, dClaimedAmount);
        
        return dClaimedAmount;
    }

    /// @dev Emitted when _reward() runs.
    /// @param claimableReward The claimable reward, including the new amount.
    event Reward(address indexed account, uint256 claimableReward);

    /// @dev Emitted when claimReward() runs.
    /// @param account The account for which the reward is being claimed.
    /// @param amount The amount of reward being claimed.
    event ClaimReward(address indexed account, uint256 amount);

}
