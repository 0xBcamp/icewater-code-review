// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../lib/FixedPoint.sol";

/**
 * @title Virtual pool contract.
 * @notice Creates a virtual pool that behaves like a typical constant product
 * pool, but tokens are minted/burned during trades rather than being swapped
 * with liquidity providers.
 * @dev This is designed to be used inside another contract that should be set
 *     as its owner.
*/
abstract contract VirtualPool is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // Use Fixed Point library for decimal ints.
    using UFixedPoint for uint256;
    using SFixedPoint for int256;

    uint256 public poolSizeA;
    uint256 public poolSizeB;
    
    uint256 private initialConstant;

    /**
    * @notice Initializer
    * @param dPoolSizeA Amount of A tokens in the virtual pool.
    * @param dPoolSizeB Amount of B tokens in the virtual pool.
    */
    function __VirtualPool_init(
        uint256 dPoolSizeA,
        uint256 dPoolSizeB
    )
        onlyInitializing public
    {
         __ReentrancyGuard_init();
        __Ownable_init();
  
        poolSizeA = dPoolSizeA;
        poolSizeB = dPoolSizeB;
        initialConstant = poolSizeA.mul(poolSizeB);
    }

    function _authorizeUpgrade(address)
        internal override
        onlyOwner
    {}

    /**
     * @notice Invoked when token A has to be subtracted from an address.
     * This is an abstract function to be implemented by child contracts.
     * Concrete implementations can perform operations such as transfering
     * tokens from the address to the pool contract (or any other contract), 
     * burn the amount, etc. 
     * @param addr The address from which the amount is taken from.
     * @param amount The amount to be taken away.
     */
    function _takeA(address addr, uint256 amount) internal virtual;

    /**
     * @notice Invoked when token B has to be subtracted from an address.
     * This is an abstract function to be implemented by child contracts.
     * Concrete implementations can perform operations such as transfering
     * tokens from the address to the pool contract (or any other contract),
     * burn the amount, etc. 
     * @param addr The address from which the amount is taken from.
     * @param amount The amount to be taken away.
     */
    function _takeB(address addr, uint256 amount) internal virtual;

    /**
     * @notice Invoked when token A has to be added to an address.
     * This is an abstract function to be implemented by child contracts.
     * Concrete implementations can perform operations such as transfering 
     * tokens from the pool contract (or any other contract) to the address, 
     * mint the amount, etc. 
     * @param addr The address from which the amount is taken from.
     * @param amount The amount to be taken away.
     */
    function _giveA(address addr, uint256 amount) internal virtual;

    /**
     * @notice Invoked when token B has to be added to an address.
     * This is an abstract function to be implemented by child contracts.
     * Concrete implementations can perform operations such as transfering 
     * tokens from the pool contract (or any other contract) to the address, 
     * mint the amount, etc. 
     * @param addr The address from which the amount is taken from.
     * @param amount The amount to be taken away.
     */
    function _giveB(address addr, uint256 amount) internal virtual; 

    /**
     * @notice Returns the spot price of A tokens in the virtual pool in terms 
     *     of B tokens.
     * @return Price of A tokens.
     */
    function priceA() public view returns(uint256) {
        return poolSizeB.div(poolSizeA);
    }

    /**
     * @notice Returns the spot price of B tokens in the virtual pool in terms
     *      of A tokens.
     * @return Price of B tokens.
     */
    function priceB() public view returns(uint256) {
        return poolSizeA.div(poolSizeB);
    }
 
    /**
     * @notice Changes the size of pools (for example to account for changes in
     *      the token supplies).
     * @param dTargetRatio Multiple by which to scale the pools.
     *
     * TODO We want to generalize this and override this functionality in
     *      concrete implementations in the future.
     */
    function scalePools(uint256 dTargetRatio) public onlyOwner {
        uint256 dTargetConstant = initialConstant.mul(dTargetRatio);
        dTargetConstant = min(dTargetConstant, poolSizeA.mul(poolSizeB)*2);

        uint256 dPriceB = priceB();

        poolSizeA = (poolSizeA + dTargetConstant.div(poolSizeB)) / 2;
        poolSizeB = poolSizeA.div(dPriceB);
    }

    /**
     * @notice Previews how many tokens would be sent to the user when swapping
     *      from A to B using the virtual pool.
     * @param dAmountA Amount of token A to be swapped by the user.
     * @return Amount of token B to be sent to the user from the swap.
     */
    function previewSwapAB(uint256 dAmountA) public view returns (uint256) {
        return calcSwapAmount(poolSizeA, poolSizeB, dAmountA);
    }

    /**
     * @notice Updates pool sizes during a swap of token A for token B using the
     *      virtual pool.
     * @param dAmountA Amount of token A to be swapped by the user.
     * @param dMinAmountB Slippace backstop, the transaction will not succeed
     *     if the resulting token B amout is less than this value.
     * @param deadline Slippace backstop, the transaction will not succeed
     *     if it is added to the blockchain after this deadline.
     * @return Amount of token B to be sent to by the user from the swap.
     */
    function swapAB(
        address addr, 
        uint256 dAmountA, 
        uint256 dMinAmountB, 
        uint256 deadline
    ) public payable nonReentrant onlyOwner returns (uint256)
    {
        require(deadline > block.timestamp, "Deadline Expired");

        // Calculate the swap return amount.
        uint256 dAmountB = calcSwapAmount(poolSizeA, poolSizeB, dAmountA);

        require(dMinAmountB <= dAmountB, "Resulting amountB < minAmountB");
        require(dAmountB < poolSizeB,
                "Resulting swap amount larger than vpool");
        
        // Update the pool sizes
        poolSizeA += dAmountA;
        poolSizeB -= dAmountB;

        // Transfer/burn/mint tokens.
        _takeA(addr, dAmountA);
        _giveB(addr, dAmountB);

        return dAmountB;
    }

    /**
     * @notice Previews how many tokens would be sent to teh user when swapping
     *      from B to A using the virtual pool.
     * @param dAmountB Amount of token B to be swapped by the user.
     * @return Amount of token A to be sent to the user from the swap.
     */    
    function previewSwapBA(uint256 dAmountB) public view returns (uint256) {
        return calcSwapAmount(poolSizeB, poolSizeA, dAmountB);
    }

    /**
     * @notice Updates pool sizes during a swap of token B for token A using the
     *      virtual pool.
     * @param dAmountB Amount of token B to be swapped by the user.
     * @param dMinAmountA Slippace backstop, the transaction will not succeed
     *     if the resulting tokan A amout is less than this value.
     * @param deadline Slippace backstop, the transaction will not succeed
     *     if it is added to the blockchain after this deadline.
     * @return Amount of token A to be sent to the user from the swap.
     */
    function swapBA(
        address addr, 
        uint256 dAmountB, 
        uint256 dMinAmountA, 
        uint256 deadline
    ) public payable nonReentrant onlyOwner returns (uint256)
    {
        require(deadline > block.timestamp, "Deadline Expired");

        // Calculate the swap return amount.
        uint256 dAmountA = calcSwapAmount(poolSizeB, poolSizeA, dAmountB);

        require(dMinAmountA <= dAmountA, "Resulting amountA < minAmountA");

        // Update the pool sizes
        require(dAmountA < poolSizeA, "Resulting swap amount larged than vpool");
        poolSizeA -= dAmountA;
        poolSizeB += dAmountB;

        // Transfer/burn/mint tokens.
        _takeB(addr, dAmountB);
        _giveA(addr, dAmountA);

        return dAmountA;
    }

    /**
     * @notice Calculates how many tokens should be swapped according to a 
     *      constant product curve.
     * @param dPoolX Size of the pool for the token being swapped.
     * @param dPoolY Size of the pool for the token being sent to the user.
     * @param dChangeX Amount of the token to be swapped by the user.
     * @return Amount of the token to be sent to the user from the swap.
     */
    function calcSwapAmount(
        uint256 dPoolX,
        uint256 dPoolY,
        uint256 dChangeX
    )
        private
        pure
        returns (uint256)
    {
        // Give up dChangeX in exchange for dChangeY
        //   dChangeY = (dPoolY * dChangeX) / (dPoolX + dChangeX)
        return dPoolY.mul(dChangeX).div(dPoolX + dChangeX);
    }

}
