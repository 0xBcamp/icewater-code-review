// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";


import "./lib/FixedPoint.sol";

import "./Constants.sol";
import "./tokens/IceToken.sol";
import "./tokens/H2OToken.sol";
import "./tokens/IceCube.sol";
import "./H2OIceVirtualPool.sol";

/** @title IceWater Controller to manage tokens and rewards.
  * @notice A stable token H2O is managed based on a measurement token ICE.
  */
contract Controller is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // Use Fixed Point library for decimal ints.
    using UFixedPoint for uint256;
    using SFixedPoint for int256;

    // The different tokens managed by the Controller.
    IceToken public iceToken;
    IceCube public iceCube;
    H2OToken public h2oToken;

    // Virtual poolsfor swapping H2O <-> ICE.
    H2OIceVirtualPool public icePool;

    // Target H2O supply.
    uint256 public dTargetH2OSupply;

    // Target supply update rate.
    int256 public dTargetH2OSupplyChangeRate;

    // Last ICE price in H2O.
    uint256 public dLastICEPrice;
    
    // Average ICE price in H2O over a period defined by iErrorUpdatePeriod.
    uint256 public dAverageICEPrice;

    // The time of the last error calculation.
    uint256 public iLastErrorTime;

    // The time of the last supply change rate update.
    uint256 public iLastUpdateTime;

    // The time the last auction started.
    uint256 public iLastAuctionTime;

    // H2O auction amount.
    uint256 public dAuctionH2OAmount;

    // whether there is an active H2O auction.
    bool public isPositiveAuctionActive;

    // whether there is an active ETH auction.
    bool public isNegativeAuctionActive;

    // Flag that defines if it is possible to cancel an auction without having
    // to wait for the auction period to be over.
    //bool public ignoreAuctionPeriod;

    // Current leading bidder address in the auction.
    address public leadingBidder;

    // Current leading bid in the auction.
    uint256 public dLeadingBid;

    // *** Settable Configuration Parameters *** //

    // Amount of H2O per reward per ICE token.
    uint256 public dMeltRate;

    // How often supply change rate is updated.
    uint256 public iErrorUpdatePeriod;

    // Target supply update error scale.
    int256 public iErrorScaleFactor;

    // What portion of the supply difference is enough to start an auction.
    uint256 public dAuctionRatio;

    // *** Initialization *** //

    /**
      * @notice Initializer. At this point the token contracts will not be set
      *     yet, so most of the external functions will fail until {setTokens()} 
      *     is called. This allows this contract to be deployed before the token
      *     contracts so that its address can be granted the admin role of those
      *     tokens.
      */
    function initialize() initializer public
    {
        __Ownable_init();
        __Pausable_init();

        iLastErrorTime = block.timestamp;
        iLastUpdateTime = block.timestamp;
        iLastAuctionTime = block.timestamp;

        // Initialize some member variable initial values.
        dTargetH2OSupply = D_INITIAL_H2O_SUPPLY;
        dMeltRate = D_DEFAULT_MELT_RATE;
        isPositiveAuctionActive = false;
        isNegativeAuctionActive = false;
        iErrorUpdatePeriod = I_DEFAULT_ERROR_UPDATE_PERIOD;
        iErrorScaleFactor = I_DEFAULT_ERROR_SCALE_FACTOR;
        dAuctionRatio = D_AUCTION_BID_RATIO;

        //ignoreAuctionPeriod = false;
    }

    /**
      * @dev Overrides the _authorizeUpgrade function to only allow the contract
      * owner to authorize upgrades.
      */
    function _authorizeUpgrade(address)
        internal override
        onlyOwner
    {}

    /**
      * @notice Sets the token contracts. This will also initialize all 
      *     necessary internal variables as well all the roles for the internal 
      *     virtual pools to be able to mint/burn tokens. This will only be able
      *     to run once.
      * @param iceToken_ ERC20 Token for Ice (Token for measuring stability)
      * @param h2oToken_ ERC20 Token for H2O (Stable Token)
      * @param iceCube_ ERC721 Token for Ice cubes.
      * @param icePool_ H2O to Ice virtual pool. Initialized separately to allow
      *     reuse when upgrading the Controller.
      */
    function setTokens(
        IceToken iceToken_,
        H2OToken h2oToken_,
        IceCube iceCube_,
        H2OIceVirtualPool icePool_
    )
        external onlyOwner
    {
        // Make sure this is only called once.
        require(address(iceToken) == address(0)
                && address(h2oToken) == address(0)
                && address(iceCube) == address(0),
            "TOKENS_ALREADY_SET");

        iceToken = iceToken_;
        h2oToken = h2oToken_;
        iceCube = iceCube_;

        // Set the H2O <-> ICE virtual pool.
        icePool = icePool_;

        // Initialize the average Ice price
        dAverageICEPrice = icePool.priceIce();

        // Store target H2O
        // Initially, we want to enable the purchase of ice cubes equal to the
        // value of ICE
        dTargetH2OSupply = D_INITIAL_H2O_SUPPLY;

        // Grant MINTER_BURNER_ROLE to the ice pool tokens.
        iceToken.grantRole(iceToken.MINTER_BURNER_ROLE(), address(icePool));
        h2oToken.grantRole(h2oToken.MINTER_BURNER_ROLE(), address(icePool));

        // Grant MINTER_BURNER_ROLE and CLAIMER_ROLE to the Controller itself so 
        // that RewardsManager can claim the rewards and mint H2O tokens.
        h2oToken.grantRole(h2oToken.MINTER_BURNER_ROLE(), address(this));
        iceToken.grantRole(iceToken.MINTER_BURNER_ROLE(), address(this));
        iceToken.grantRole(iceToken.CLAIMER_ROLE(), address(this));
        iceCube.grantRole(iceCube.MINTER_REDEEMER_ROLE(), address(this));
    }

    /**
      * notice Allows the contract owner to set whether to ignore the auction
      *     period or not.
      * param ignore Whether to ignore the auction period or not.
      */
    //function setIgnoreAuctionPeriod(bool ignore) external onlyOwner
    //{
    //    ignoreAuctionPeriod = ignore;
    //}

    /**
      * @dev Receives ETH sent to the contract.
      */
    receive() external payable {}

    // *** Pausable *** //

    /**
      * @notice Pauses the contract and, optionally, the associated tokens.
      * @param pauseTokens Whether to pause the associated tokens or not.
      */
    function pause(bool pauseTokens) external onlyOwner {
        _pause();
        if (pauseTokens) {
            iceToken.pause();
            h2oToken.pause();
            iceCube.pause();
        }
    }

    /**
      * @notice Unpauses the contract and, optionally, the associated tokens.
      * @param unpauseTokens Whether to unpause the associated tokens or not.
      */
    function unpause(bool unpauseTokens) external onlyOwner 
    {
        _unpause();
        if (unpauseTokens) {
            iceToken.unpause();
            h2oToken.unpause();
            iceCube.unpause();
        }
    }


    // *** Getters *** //

    /**
      * @notice Getter for the current price in H2O of the ICE token according
      *     to the internal virtual pools.
      * @return uint256 Price for ICE token in H2O with 18 decimals.
      */
    function getICEPrice() external view returns (uint256) 
    {
        return icePool.priceIce();
    }

    /**
      * @notice Getter for the current average price in H2O of the ICE token.
      * @return uint256 Price for ICE token in H2O with 18 decimals.
      */
    function getAverageICEPrice() external view returns (uint256) 
    {
        return dAverageICEPrice;
    }

    /**
      * @notice Getter for the amount of ICE in the ICE/H2O virtual pool.
      * @return uint256 Amount of ICE token with 18 decimals.
      */
    function getICEPoolICESize() external view returns (uint256) 
    {
        return icePool.poolSizeB();
    }

    /**
      * @notice Getter for the amount of H2O in the ICE/H2O virtual pool.
      * @return uint256 Amount of H2O token with 18 decimals.
      */
    function getICEPoolH2OSize() external view returns (uint256) 
    {
        return icePool.poolSizeA();
    }

    // *** Configurable Parameter Setters *** //

    function setMeltRate(uint256 value) external onlyOwner
    {
        dMeltRate = value;
    }

    /**
      * @notice Sets the period for updating the target supply error in seconds.
      * @param iValue The value to set for the error update period.
      */
    function setErrorUpdatePeriod(uint256 iValue) external onlyOwner
    {
        iErrorUpdatePeriod = iValue;
    }

     /**
      * @notice Sets the error scale factor.
      * @param iValue The value to set for the error scale factor.
      */
    function setErrorScaleFactor(int256 iValue) external onlyOwner
    {
        iErrorScaleFactor = iValue;
    }

    /**
      * @notice Sets the auction ratio.
      * @param dValue The value to set for the auction ratio.
      */
    function setAuctionRatio(uint256 dValue) external onlyOwner
    {
        dAuctionRatio = dValue;
    }

    //*** Token Swap Functions ***//

    /**
      * @notice Previews how much ICE results from swapping H2O to ICE using the
      *     ICE/H2O virtual pool.
      * @param dH2OAmount Amount of H2O token to be swapped with 18 decimals.
      * @return uint256 Amount of ICE token that will be sent to user with 18
      *     decimals.
      */
    function previewSwapH2OForICE(uint256 dH2OAmount)
        external view returns (uint256)
    {
        return icePool.previewSwapAB(dH2OAmount);
    }

    /**
      * @notice Previews how much H2O results from swapping ICE to H2O using the 
      *     ICE/H2O virtual pool.
      * @param dICEAmount Amount of ICE token to be swapped with 18 decimals.
      * @return uint256 Amount of H2O token that will be sent to user with 18
      *     decimals.
      */
    function previewSwapICEForH2O(uint256 dICEAmount)
        external view returns (uint256) 
    {
        return icePool.previewSwapBA(dICEAmount);
    }

    /**
      * @notice Swaps H2O for ICE using the cold virtual pool (ICE/H2O virtual
      *     pool).
      * @param dH2OAmount Amount of H2O token to be swapped with 18 decimals.
      * @param dMinICEAmount Slippace backstop, the transaction will not succeed
      *     if the resulting ICE amout is less than this value.
      * @param deadline Slippace backstop, the transaction will not succeed
      *     if it is added to the blockchain after this deadline.
      * @return uint256 Amount of ICE token sent to user with 18 decimals.
      */
    function swapH2OForICE(
        uint256 dH2OAmount,
        uint256 dMinICEAmount,
        uint256 deadline
    ) external whenNotPaused returns (uint256)
    {
        // Update the target supply
        // Note: At beginning of function to avoid flash loan attack
        _updateTargetSupply();

        uint256 dICEAmount = icePool.swapAB(
            _msgSender(),
            dH2OAmount,
            dMinICEAmount,
            deadline);

        emit Swap(
            msg.sender,
            address(h2oToken), dH2OAmount,
            address(iceToken), dICEAmount);

        return dICEAmount;
    }

    /**
      * @notice Swaps ICE for H2O using the cold virtual pool (ICE/H2O virtual
      *         pool).
      * @param dICEAmount Amount of ICE token to be swapped with 18 decimals.
      * @param dMinH2OAmount Slippace backstop, the transaction will not succeed
      *     if the resulting H2O amout is less than this value.
      * @param deadline Slippace backstop, the transaction will not succeed
      *     if it is added to the blockchain after this deadline.
      * @return uint256 Amount of H2O token sent to user with 18 decimals.
      */
    function swapICEForH2O(
        uint256 dICEAmount,
        uint256 dMinH2OAmount,
        uint256 deadline
    ) external whenNotPaused returns (uint256) 
    {
        // Note: At beginning of function to avoid flash loan attack
        _updateTargetSupply();

        uint256 dH2OAmount = icePool.swapBA(
            _msgSender(),
            dICEAmount,
            dMinH2OAmount,
            deadline);
        
        emit Swap(
            msg.sender,
            address(iceToken), dICEAmount,
            address(h2oToken), dH2OAmount);

        return dH2OAmount;
    }

    //*** Ice Cubes ***//

    /**
      * @notice Function to create an IceCube by burning ICE tokens.
      * @param amount The amount of ICE tokens to burn.
      * @param recipient The address of the recipient of the IceCube.
      * @param endTime The timestamp indicating when the IceCube will expire.
      * @return tokenId The ID of the created IceCube.
      */
    function mintIceCube(
        uint256 amount,
        address recipient,
        uint256 endTime
    ) external whenNotPaused returns (uint256) 
    {
        iceToken.burn(msg.sender, amount);
        uint256 tokenId = iceCube.mint(
            msg.sender, recipient, amount, block.timestamp, endTime);

        emit MintCube(msg.sender, recipient, amount, endTime, tokenId);

        return tokenId;
    }

    /**
      * @notice Function to redeem an IceCube -- external end point
      * @param tokenId The ID of the IceCube to be redeemed.
      * @return dAmount The amount of ICE tokens redeemed.
      */
    function redeemIceCube(uint256 tokenId) external whenNotPaused returns (uint256) {
        require(msg.sender == iceCube.getRedeemer(tokenId),
                "Only the redeemer can redeem an Ice Cube.");
        
        uint256 dAmount = _redeemIceCube(tokenId);
        emit RedeemCube(msg.sender, tokenId, dAmount);
        return dAmount;
    }

    /**
      * @dev Internal function to redeem/end an IceCube.
      * @param tokenId The ID of the IceCube to be redeemed.
      * @return dAmount The amount of ICE tokens redeemed.
      */
    function _redeemIceCube(uint256 tokenId) internal returns (uint256) {
        uint256 dAmount = iceCube.getAmount(tokenId);
        iceCube.redeem(tokenId);
        iceToken.mint(iceCube.getRedeemer(tokenId), dAmount);
        return dAmount;
    }

    //*** Token Rewards ***//

    /**
      * @notice Returns the rewards rate for ICE at an annual rate (e.g., annual
      *         interest rate).
      * @return ICE annual rewards rate with 18 decimals.
      */
    function annualMeltRate() external view returns (uint256) {
        return dMeltRate * I_YEAR;
    }
    
    /**
      * @notice Returns the amount of ICE rewards available for the sender.
      * @return Amount of ICE rewards with 18 decimals.
      */
    function claimableH2OFromICE() external view returns (uint256) {
        return iceToken.claimableReward(msg.sender).mul(dMeltRate);
    }

    /**
      * @notice Sends ICE rewards to msg.sender in H2O.
      * @return Amount of rewards claimed with 18 decimals.
      */
    function claimRewards()
        external whenNotPaused
        returns (uint256)
    {
        uint256 dAmount = iceToken.claimReward(msg.sender).mul(dMeltRate);

        // Mint H2O amount.
        h2oToken.mint(msg.sender, dAmount);

        // Update the pool sizes
        uint256 dScaleRatio = dTargetH2OSupply.div(D_INITIAL_H2O_SUPPLY);
        icePool.scalePools(dScaleRatio);

        emit ClaimRewards(msg.sender, dAmount);

        return dAmount;
    }

    /**
      * @dev Calculates the rewards earned by an Ice Cube token holder up to the
      *      current time.
      * @param tokenId The ID of the Ice Cube token for which to calculate
      *                rewards.
      * @return The amount of ICE earned as rewards.
      */
    function _getRewardsFromCube(uint256 tokenId)
        internal view whenNotPaused
        returns (uint256)
    {
        uint256 iEndTime = iceCube.getEndTime(tokenId);
        uint256 iStopTime = min(block.timestamp, iEndTime);
        uint256 iTimeDelta = iStopTime - iceCube.getLastRewardTime(tokenId);
        return (iceCube.getAmount(tokenId)*(iTimeDelta)).mul(dMeltRate);
    }

    /**
      * @dev Calculates the rewards earned by an Ice Cube token holder up to the
      *      current time (for preview purposes only).
      * @param tokenId The ID of the Ice Cube token for which to calculate
      *                rewards.
      * @return The amount of ICE earned as rewards.
      */
    function previewRewardsFromCube(uint256 tokenId)
        external view whenNotPaused
        returns (uint256)
    {
        return _getRewardsFromCube(tokenId);
    }

    /**
      * @notice Sends ICE rewards to msg.sender in H2O.
      * @param tokenId The ID of the Ice Cube token to claim rewards from
      * @return Amount of rewards claimed with 18 decimals.
      */
    function claimRewardsFromCube(uint256 tokenId)
        external whenNotPaused
        returns (uint256)
    {
        require(msg.sender == iceCube.ownerOf(tokenId),
                "Only owner can claim rewards");
        
        uint256 dAmount = _getRewardsFromCube(tokenId);

        iceCube.claimRewards(tokenId);

        // Mint H2O amount.
        h2oToken.mint(msg.sender, dAmount);

        uint256 iEndTime = iceCube.getEndTime(tokenId);
        if (block.timestamp >= iEndTime &&
                iceCube.isRedeemed(tokenId) == false) {
            _redeemIceCube(tokenId);
        }

        // Update the pool sizes
        uint256 dScaleRatio = dTargetH2OSupply.div(D_INITIAL_H2O_SUPPLY);
        icePool.scalePools(dScaleRatio);

        emit ClaimRewardsFromCube(msg.sender, tokenId, dAmount);

        return dAmount;
    }

    //*** Update Target Supply ***//

    /**
      * @notice Updates the current (proportional) error and accumulated
      *         (integral) error and stores the values.
      */
    function _updateTargetSupply() internal {
        // Save these values into local memory variables in order to save gas.
        uint256 iTmpErrorUpdatePeriod = iErrorUpdatePeriod;
        uint256 dTmpTargetH2OSupply = dTargetH2OSupply;

        uint256 iTimeDelta = block.timestamp - iLastErrorTime;

        // Avoid running multiple times in a block
        if (iTimeDelta == 0) {
            return;
        }

        // avoid changes based on periods greater than the update period
        iTimeDelta = min(iTimeDelta, iTmpErrorUpdatePeriod);
        iLastErrorTime = block.timestamp;

        // Calculate the errors:
        // If the ICE price is higher than 1 (i.e., the H2O price), we want to
        // mint H2O.
        // If the ICE price is lower than 1 (i.e., the H2O price), we want to
        // burn H2O
        uint256 dTmpLastIcePrice = icePool.priceIce();
        dLastICEPrice = dTmpLastIcePrice;

        // Average the ICE price so it is harder to manipuate the update with a
        // last second tx.
        uint256 dTmpAverageICEPrice = _timeAverage(
            dTmpLastIcePrice, iTimeDelta, dAverageICEPrice,
            iTmpErrorUpdatePeriod);
        dAverageICEPrice = dTmpAverageICEPrice;

        uint256 iNextUpdateTime = iLastUpdateTime + iTmpErrorUpdatePeriod;

        // This is only going to happen once every update period. It is used to
        // ensure previous changes have been factored in before we update again.
        if (block.timestamp >= iNextUpdateTime) {
            int256 dBaseAdjustment;

            // The base adjustment comes from the equation
            //     P = C/R = C/(R_t + R_x)
            //   P = ice price,
            //   C = melt rate (coupon)
            //   R = target discount rate
            //   R_x = excess rate
            // Ee want to make an adjustment proportional to -R_x
            // R_x = C/P - R_t = C(1/P - R_t/C) = C(1/P - 1), assuming C = R_t
            // so the base adjustment = C(1 - 1/P) = meltrate(1 - 1/IcePrice)
            if (dTmpLastIcePrice < 1e18) {
                dBaseAdjustment = int256(dMeltRate).mul(
                    1e18 - int256(1e18).div(int256(dTmpAverageICEPrice)));
            } else {
                // However, if IcePrice > 1, we don't want the adjustment to be
                // limited to 1 we want the adjustment to be 0 and the slope to
                // be 1 at P = 1.
                dBaseAdjustment = int256(dMeltRate).mul(
                    int256(dTmpAverageICEPrice) - 1e18);
            }

            // Scaled error measured in H2O per second.
            // we scale by the target supply and by a fudge factor:
            //     factor - iErrorScaleFactor.
            int256 dScaledAdjustment = dBaseAdjustment.mul(
                int256(dTmpTargetH2OSupply) * iErrorScaleFactor);

            // Update the dTargetH2OSupplyChangeRate based on our calculated
            // adjustment.
            dTargetH2OSupplyChangeRate += dScaledAdjustment;
            iLastUpdateTime = iNextUpdateTime;
        }

        // Calculate the target supply change based on the current rate. We do
        // this regardless of whether the rate has been updated.
        int256 dTargetH2OSupplyChange =
            dTargetH2OSupplyChangeRate * int256(iTimeDelta);

        // update the target supply
        dTargetH2OSupply = uint256(
            max(int256(dTmpTargetH2OSupply) + dTargetH2OSupplyChange, 1e18) );

    }

    /**
      * @dev Calculates the continuous time-average of a given amount and the
      *      previous average over a period of time.
      * @param amount The amount to calculate the average with.
      * @param time The time duration since the last update.
      * @param prevAvg The previous average value.
      * @param avgPeriod The average period to consider.
      * @return The new time-average value.
      */
    function _timeAverage(
        uint256 amount,
        uint256 time, 
        uint256 prevAvg, 
        uint256 avgPeriod
    ) internal pure returns (uint256) 
    {
        // Continuous averaging function of X (i.e., the prevAvg) and Y (i.e.,
        // the amount) for period T out of P:
        //     X(P - T)/P + Y*T/P = (X*P - X*T + Y*T)/P = X + (Y - X)*T/P
        // This approaches but does not equal an arithmetic average, but it and 
        // can be calculated continously without keeping track of a price
        // history.
        return uint256(int256(prevAvg) + 
            (int256(amount) - int256(prevAvg)).mul(
            int256(1e18 * min(time, avgPeriod) / avgPeriod)));
    }

    //*** Positive Auctions -- mint H2O ***//

    /**
      * @notice Initiates a positive auction to mint H2O tokens. Requires
      * sending some ETH (msg.value).
      */
    function initiatePositiveAuction() external payable whenNotPaused
    {
        uint256 dTmpTotalSupply = h2oToken.totalSupply();
        uint256 dTmpTargetH2OSupply = dTargetH2OSupply;
        
        require (dTmpTotalSupply < dTmpTargetH2OSupply, "Auction not available.");
        require (!isPositiveAuctionActive && !isNegativeAuctionActive,
                 "There is already an active auction.");

        isPositiveAuctionActive = true;
        // auction off the difference between supply and target supply
        dAuctionH2OAmount = dTmpTargetH2OSupply - dTmpTotalSupply;
        leadingBidder = msg.sender;
        dLeadingBid = msg.value;
        iLastAuctionTime = block.timestamp;

        emit InitiateAuction(msg.sender, true, msg.value,
                             dTmpTargetH2OSupply - dTmpTotalSupply, block.timestamp);
    }

    /**
      * @notice Creates a positive auction bid to mint H2O tokens.
      * To make a bid you need to send more ETH than the existing bid.
      * The address you outbid gets their ETH back.
      */
    function makePositiveAuctionBid() external payable whenNotPaused
    {
        //Load before require statements for gas optimization
        address previousLeadingBidder = leadingBidder;
        uint256 dPreviousLeadingBid = dLeadingBid;

        require (isPositiveAuctionActive == true,
                 "There is no active auction.");
        require (msg.value > dPreviousLeadingBid, 
                 "New bid must be more than previous bid.");

        // change the leading bidder
        leadingBidder = msg.sender;
        dLeadingBid = msg.value;

        if (block.timestamp > (iLastAuctionTime + I_DEFAULT_AUCTION_PERIOD)) {
            _closePositiveAuction();
        }

        // the previous leading bidder gets their ETH back
        sendETH(previousLeadingBidder, dPreviousLeadingBid, '');

        emit AuctionBid(msg.sender, true, msg.value);
    }

    /**
      * @notice Terminates a positive acution.
      * The auction goes for a predefined period of time, so someone needs to
      * end it.
      */
    function terminatePositiveAuction() external whenNotPaused
    {
        require(isPositiveAuctionActive == true, "There is no active auction.");
        //require(ignoreAuctionPeriod || block.timestamp > (
        //        iLastAuctionTime + I_DEFAULT_AUCTION_PERIOD),
        //        "There is still time remaining in the Auction.");
        require(block.timestamp > (iLastAuctionTime + I_DEFAULT_AUCTION_PERIOD),
                "There is still time remaining in the Auction.");
        _closePositiveAuction();
    }

    /**
      * @dev closes a positive acution.
      * This is separated out because it can be called from 
      * terminatePositiveAuction(), or as a side effect of a bid after the end
      * of the auction period.
      */
    function _closePositiveAuction() internal {
        isPositiveAuctionActive = false;
        h2oToken.mint(leadingBidder, dAuctionH2OAmount);
        
        emit CloseAuction(leadingBidder, true, dLeadingBid, dAuctionH2OAmount);
    }

    //*** Negative Auctions -- burn H2O***//

    /**
      * @notice Start a negative auction for a fixed amount of H2O in return for
      * a given amount of ETH. The ETH amount is how much you want to get back,
      * which will go down over the course of the auction.
      * @param _H2OAmount The amount of H2O being auctioned off.
      * @param _ETHAmount The amount of ETH requested by the bidder in exchange
      *     for the H2O.
      */
    function initiateNegativeAuction(
        uint256 _H2OAmount, 
        uint256 _ETHAmount
    ) external whenNotPaused
    {
        uint256 dTmpTotalSupply = h2oToken.totalSupply();
        uint256 dTmpTargetH2OSupply = dTargetH2OSupply;

        require(dTmpTotalSupply > dTmpTargetH2OSupply, "Auction not available.");
        require(_H2OAmount > 
                (dTmpTotalSupply - dTmpTargetH2OSupply).mul(dAuctionRatio),
                "The H2O amount is not enough.");
        require(_H2OAmount <= 
                (dTmpTotalSupply - dTmpTargetH2OSupply),
                "The H2O amount must be less than the target supply change.");

        require(isPositiveAuctionActive == false &&
                    isNegativeAuctionActive == false,
                "There is already an active auction.");
        require(address(this).balance >= _ETHAmount, 
                "There is not enough ETH available.");

        // set the amount of the auction
        dAuctionH2OAmount = _H2OAmount;

        isNegativeAuctionActive = true;
        leadingBidder = msg.sender;
        dLeadingBid = _ETHAmount;
        iLastAuctionTime = block.timestamp;

        // bidder has to put up the amount they are going to burn if they win
        h2oToken.burn(msg.sender, _H2OAmount);

        emit InitiateAuction(
            msg.sender, false, _ETHAmount, _H2OAmount, block.timestamp);
    }

    /**
      * @notice Allows a user to bid on an ongoing negative auction.
      * The H2O amount of the auction is set initially, and you need to bid a 
      * smaller amount of ETH to win. You can also increase the amount of H2O
      * that will be burned.
      * @param _H2OAmount The amount of H2O to burn and add to the auction. If
      *     set to 0, the H2O amount remains the same.
      * @param _ETHAmount The amount of ETH to bid on the auction. Must be less
      *     than the current leading bid.
      */
    function makeNegativeAuctionBid(
        uint256 _H2OAmount, 
        uint256 _ETHAmount
    ) external whenNotPaused 
    {
        uint256 dTmpAmount = dAuctionH2OAmount;

        require(isNegativeAuctionActive == true,
                "There is no active auction.");
        require(address(this).balance >= _ETHAmount, 
                "There is not enough ETH available.");
        require(_ETHAmount / (_H2OAmount + dTmpAmount) <
                    dLeadingBid / dTmpAmount,
                "New bid must be less than previous bid.");

        if (_H2OAmount > 0){
            require(_H2OAmount + dTmpAmount <= h2oToken.totalSupply() - dTargetH2OSupply, 
                "The H2O amount must be less than the target supply change.");

            // Reset the amount of the auction.
            dAuctionH2OAmount = _H2OAmount + dTmpAmount;
        }

        h2oToken.burn(msg.sender, _H2OAmount + dTmpAmount);
        h2oToken.mint(leadingBidder, dTmpAmount);
        leadingBidder = msg.sender;
        dLeadingBid = _ETHAmount;

        if (block.timestamp > (iLastAuctionTime + I_DEFAULT_AUCTION_PERIOD)) {
            _closeNegativeAuction();
        }

        emit AuctionBid(msg.sender, false, _ETHAmount);
    }

    /**
     * @notice Terminate an active negative auction
     * @dev This function can be called by the owner of the contract only when
     * there is an active negative auction and either the auction period has
     * elapsed or the owner has set `ignoreAuctionPeriod` to true
     */
    function terminateNegativeAuction() external whenNotPaused {
        require(isNegativeAuctionActive == true, "There is no active auction.");
        //require(ignoreAuctionPeriod || block.timestamp >
        //        (iLastAuctionTime + I_DEFAULT_AUCTION_PERIOD),
        //        "There is still time remaining in the Auction");
        require(block.timestamp > (iLastAuctionTime + I_DEFAULT_AUCTION_PERIOD),
                "There is still time remaining in the Auction");
        _closeNegativeAuction();
    }

    /**
     * @notice Close the active negative auction
     * @dev This function is called by `terminateNegativeAuction()` when the
     *      auction is ready to be closed or as a side effect of a bid after the 
     *      auction period.
     */
    function _closeNegativeAuction() internal {
        isNegativeAuctionActive != false;

        sendETH(leadingBidder, dLeadingBid, '');

        emit CloseAuction(leadingBidder, false, dLeadingBid, dAuctionH2OAmount);
    }

    /**
     * @notice Send ETH to an address
     * @dev This function sends a specified amount of ETH to the given address
     * @param to The recipient address of the ETH
     * @param dETHAmount The amount of ETH to be sent in wei
     * @param data Additional data to include in the transaction
     */
    function sendETH(
        address to,
        uint256 dETHAmount,
        bytes memory data
    ) internal returns (bool) {
        // Fails if contract balance is less than dETHAmount
        (bool sent, ) = to.call{ value: dETHAmount }(data);
        return sent;
    }

    //***Events***//

    event Swap(address indexed account,
        address tokenFrom, uint256 amountFrom,
        address tokenTo, uint256 amountTo);

    event ClaimRewards(address indexed account,
        uint256 h2oAmount);

    event MintCube(address indexed senderAccount,
        address indexed recipient, uint256 amount,
        uint256 endTime, uint256 tokenId);

    event RedeemCube(address indexed redeemer, uint256 tokenId,
        uint256 amount);

    event ClaimRewardsFromCube(address indexed account,
        uint256 tokenId,
        uint256 h2oAmount);

    event InitiateAuction(address indexed leadingBidder,
        bool positiveAuction, uint256 dLeadingBid,
        uint256 auctionAmount, uint256 auctionTime);
        
    event AuctionBid(address indexed leadingBidder,
        bool positiveAuction, uint256 dLeadingBid);

    event CloseAuction(address indexed leadingBidder,
        bool positiveAuction, uint256 dLeadingBid,
        uint256 auctionAmount);
}
