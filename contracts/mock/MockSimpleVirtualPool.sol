// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../abstract/VirtualPool.sol";

contract MockSimpleVirtualPool is VirtualPool
{

    function initialize(
        uint256 dPoolSizeA,
        uint256 dPoolSizeB
    )
        initializer public
    {
        __VirtualPool_init(dPoolSizeA, dPoolSizeB);
    }

    function _takeA(address addr, uint256 amount) internal override
    {
    }
    
    function _takeB(address addr, uint256 amount) internal override
    {
    }
    
    function _giveA(address addr, uint256 amount) internal override
    {
    }
    
    function _giveB(address addr, uint256 amount) internal override
    {
    } 


}
