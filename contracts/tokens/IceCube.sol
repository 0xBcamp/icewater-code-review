// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../lib/FixedPoint.sol";
import "../abstract/ERC721Base.sol";

import "@openzeppelin/contracts/utils/Counters.sol";

/// @title Ice Cube Contract (NFTs for removing H2O from the system).
contract IceCube is ERC721Base
{
    // Use Fixed Point library for decimal ints.
    using UFixedPoint for uint256;
    using SFixedPoint for int256;

    /// @dev AccessControl role that gives access to createIceCube()
    bytes32 public constant MINTER_REDEEMER_ROLE = keccak256("MINTER_REDEEMER_ROLE");

    // Keeps track of the number of tokens minted so far.
    using Counters for Counters.Counter;
    Counters.Counter private _idCounter;

    // Holds the per-cube data.
    struct Params {
        bool redeemed;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        uint256 lastRewardTime;
        address redeemer;
    }
    mapping(uint256 => Params) private params;

    mapping (address => uint256[]) private _creatorBalances;

    modifier onlyExisting(uint256 id) {
        require(_exists(id), "Invalid IceCube ID.");
        _;
    }

    modifier onlyNotRedeemed(uint256 id) {
        require(!params[id].redeemed, "IceCube already redeemed.");
        _;
    }

    /// @notice Initializer
    /// @param admins Addresses that will be granted the DEFAULT_ADMIN_ROLE.
    function initialize(address[] memory admins) 
        initializer public
    {
        __ERC721Base_init("Ice Cube", "ICECUBE", admins);
    }

    /**
     * @notice Check if `spender` is approved or owner of `tokenId`.
     * @param spender Address of the spender
     * @param tokenId Identifier of the token
     * @return bool
     */
    function isApprovedOrOwner(address spender, uint256 tokenId)
        external view
        returns (bool)
    {
        return _isApprovedOrOwner(spender, tokenId);
    }

    /**
     * @notice Check if the specified token has been redeemed.
     * @param id Identifier of the token
     * @return bool
     */
    function isRedeemed(uint256 id)
        public view onlyExisting(id)
        returns (bool)
    {
        return params[id].redeemed;
    }

    /**
     * @notice Get the address of the redeemer for the specified token.
     * @param id Identifier of the token
     * @return address
     */
    function getRedeemer(uint256 id)
        public view onlyExisting(id)
        returns (address)
    {
        return params[id].redeemer;
    }

    /**
     * @notice Get the amount of ICE used to mint the specified token.
     * @param id Identifier of the token
     * @return uint256
     */
    function getAmount(uint256 id)
        public view onlyExisting(id)
        returns (uint256)
    {
        return params[id].amount;
    }

    /**
     * @notice Get the start time of the specified token.
     * @param id Identifier of the token
     * @return uint256
     */
    function getStartTime(uint256 id)
        public view onlyExisting(id)
        returns (uint256)
    {
        return params[id].startTime;
    }

    /**
     * @notice Get the end time of the specified token.
     * @param id Identifier of the token
     * @return uint256
     */
    function getEndTime(uint256 id)
        public view onlyExisting(id)
        returns (uint256)
    {
        return params[id].endTime;
    }

    /**
     * @notice Get the timestamp of the last reward update for the specified token.
     * @param id Identifier of the token
     * @return uint256
     */
    function getLastRewardTime(uint256 id)
        public view onlyExisting(id)
        returns (uint256)
    {
        return params[id].lastRewardTime;
    }

    /**
     * @notice Get the number of ICECubes owned by the specified creator address.
     * @param redeemer Address of the creator
     * @return uint256
     */
    function getCreatorBalanceOf(address redeemer)
        public view
        returns (uint256)
    {
        return _creatorBalances[redeemer].length;
    }

    /**
     * @notice Get the identifier of the specified ICECube owned by the specified creator address, at the specified index.
     * @param redeemer Address of the creator
     * @param index Index of the ICECube
     * @return uint256
     */
    function getCreatorCubeIdByIndex(address redeemer, uint256 index)
        public view
        returns (uint256)
    {
        require(index < _creatorBalances[redeemer].length, "Index out of range");
        return _creatorBalances[redeemer][index];
    }

    /**
     * @notice Mints a new ice cube NFT for recipient.
     * @param recipient The address to mint the NFT to.
     * @return id An identifier for the NFT.
     */
    function mint(
        address creator,
        address recipient,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    )
        external whenNotPaused onlyRole(MINTER_REDEEMER_ROLE)
        returns (uint256)
    {
        // Mint starting with Id 1.
        _idCounter.increment();
        uint256 id = _idCounter.current();
        _safeMint(recipient, id);

        // Set the parameters for the new cube.
        params[id] = Params(
            false, amount, startTime, endTime, startTime, creator);

        _creatorBalances[creator].push(id);

        return id;
    }

    /**
     * @notice Claim the accumulated rewards.
     * @param id The id of the ice cube.
     */
    function claimRewards(uint256 id)
        external whenNotPaused
        onlyExisting(id) onlyRole(MINTER_REDEEMER_ROLE)
    {
        params[id].lastRewardTime = min(block.timestamp, params[id].endTime);
    }

    /**
     * @notice Redeem the ice cube.
     * @param id The id of the ice cube.
     */
    function redeem(uint256 id)
        external
        whenNotPaused
        onlyExisting(id) onlyNotRedeemed(id) onlyRole(MINTER_REDEEMER_ROLE)
    {
        require(block.timestamp > params[id].endTime, "Cannot redeem an active Ice Cube.");
        params[id].redeemed = true;
    }
}
