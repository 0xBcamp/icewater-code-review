// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./lib/FixedPoint.sol";

contract Distribution {
    // Use Fixed Point library for decimal ints.
    using UFixedPoint for uint256;

    function distribute(address contractAddress, address[] memory addresses, uint256 distSupply)
    public {
        ERC20 token = ERC20(contractAddress);

        uint256 balance = token.balanceOf(msg.sender);
        require(distSupply <= balance, "Distribution Supply > Total Supply!");

        uint256 amount = distSupply / addresses.length;

        for (uint i = 0; i < addresses.length; i++) {
            token.transferFrom(msg.sender, addresses[i], amount);
        }
    }

    function distributeAmount(address contractAddress, address[] memory addresses, uint256 amount)
    public {
        ERC20 token = ERC20(contractAddress);

        require(amount * addresses.length <= token.balanceOf(msg.sender),
            "Total amounts > Total Supply!");

        for (uint i = 0; i < addresses.length; i++) {
            token.transferFrom(msg.sender, addresses[i], amount);
        }

    }

    function distributeAmounts(address contractAddress, address[] memory addresses, uint256[] memory amounts)
    public {
        require(addresses.length == amounts.length,
            "The number of addresses doesn't match the number of amounts.");

        ERC20 token = ERC20(contractAddress);

        uint256 balance = token.balanceOf(msg.sender);
        uint256 sum = 0;

        for (uint i = 0; i < addresses.length; i++) {
            sum += amounts[i];
            require(sum <= balance, "Total amounts > Total Supply!");

            token.transferFrom(msg.sender, addresses[i], amounts[i]);
        }

    }
}