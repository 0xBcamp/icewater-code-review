// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../abstract/VirtualPool.sol";

contract MockEthVirtualPool is VirtualPool
{
    bool public ready;

    // TokenA: eth / TokenB: IceToken
    function initialize(
        uint256 dPoolSizeA,
        uint256 dPoolSizeB
    )
        initializer public
    {
        __VirtualPool_init(dPoolSizeA, dPoolSizeB);

        ready = false;
    }

    // Initial deposit
    function deposit() external payable {
        require(!ready, "Initial Eth already deposited.");

        if (address(this).balance >= poolSizeA) {
            ready = true;
        }
    }

    modifier isReady()
    {
        require(ready, "Initial Eth not deposited yet");
        _;
    }

    function _takeA(address addr, uint256 amount) internal override isReady
    {
        require(msg.value >= amount, "Eth sent less than amount to swap.");

        uint256 change = msg.value - amount;
        payable(addr).transfer(change); 
    }
    
    function _takeB(address addr, uint256 amount) internal override isReady
    {
    }
    
    function _giveA(address addr, uint256 amount) internal override isReady
    {
        require(amount <= address(this).balance, "Eth swap amount larger than the pool.");
        address payable to = payable(addr);
        (bool success, ) = to.call{value: amount}("");
        require(success, "Error sending ETH.");
    }
    
    function _giveB(address addr, uint256 amount) internal override isReady
    {
    } 


}
