// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

// *** Generic constants.  *** //

// Seconds in a year.
uint256 constant I_YEAR = uint256(365 days);

// Seconds in a day.
uint256 constant I_DAY = uint256(1 days);

// *** Initial constant values.  *** //

// Token Initial supplies.
uint256 constant D_INITIAL_ICE_SUPPLY = 100000e18; // 100K
uint256 constant D_INITIAL_H2O_SUPPLY = 1000000e18; // 1M
uint256 constant D_INITIAL_STM_SUPPLY = 1000000e18; // 1M

// Initial pool sizes
uint256 constant D_INITIAL_ICE_POOL_H2O_SIZE = 100000e18; // 100K

// *** Default values for adjustable configs.  *** //

// Initial ICE dividend in H2O per second
uint256 constant D_DEFAULT_MELT_RATE = 2e16 / I_YEAR; // .02 H20 per year

// The percentage of ICE that is lost when you make a transfer of ICE
uint256 constant D_DEFAULT_ICE_TRANSFER_TAX = 2e16; // 2% tax

// Tells if the Ice token can be transferred between accounts.
bool constant D_DEFAULT_IS_ICE_TRANSFERABLE = true;

// How often the error
uint256 constant I_DEFAULT_ERROR_UPDATE_PERIOD = 30 * I_DAY; // 30 days

// Scale how fast the target supply updates
int256 constant I_DEFAULT_ERROR_SCALE_FACTOR = 10;

// How long an auction lasts
uint256 constant I_DEFAULT_AUCTION_PERIOD = 30 * I_DAY; // 30 days

// Bid ratio for negative auctions
uint256 constant D_AUCTION_BID_RATIO = 2e17; // 20%

// STM rewards decay
uint256 constant D_DEFAULT_STM_REWARDS_DECAY_RATE = 0;
