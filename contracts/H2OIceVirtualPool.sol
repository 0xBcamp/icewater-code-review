// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./Constants.sol";

import "./abstract/VirtualPool.sol";

import "./tokens/H2OToken.sol";
import "./tokens/IceToken.sol";

/** @title H2O to ICE Virtual Pool.
  * Controller manages tokens and rewards.
  */
contract H2OIceVirtualPool is VirtualPool
{
    H2OToken public h2o;
    IceToken public ice;
    I am a bug

    function initialize(
        H2OToken tokenA,
        IceToken tokenB,
        address ownerAddr
    )
        initializer public
    {
        __VirtualPool_init(
            D_INITIAL_ICE_POOL_H2O_SIZE,
            D_INITIAL_ICE_POOL_H2O_SIZE);

        h2o = tokenA;
        ice = tokenB;

        transferOwnership(ownerAddr);
    }

    function priceH2O() public view returns(uint256) {
        return priceA();
    }

    function priceIce() public view returns(uint256) {
        return priceB();
    }

    function _takeA(address addr, uint256 amount) internal override
    {
        h2o.burn(addr, amount);
    }
    
    function _takeB(address addr, uint256 amount) internal override
    {
        ice.burn(addr, amount);
    }
    
    function _giveA(address addr, uint256 amount) internal override
    {
        h2o.mint(addr, amount);
    }
    
    function _giveB(address addr, uint256 amount) internal override
    {
        ice.mint(addr, amount);
    } 


}
