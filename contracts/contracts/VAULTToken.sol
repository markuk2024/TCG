// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title VAULTToken
 * @dev Main governance and staking token for TCG Vault Protocol
 * Fixed supply with potential for deflationary mechanics
 */
contract VAULTToken is ERC20, ERC20Burnable, Ownable {
    
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18; // 100M tokens
    uint256 public constant INITIAL_SUPPLY = 10_000_000 * 10**18; // 10M initial
    
    // Distribution allocations
    uint256 public constant TEAM_ALLOCATION = 15; // 15%
    uint256 public constant TREASURY_ALLOCATION = 25; // 25%
    uint256 public constant COMMUNITY_ALLOCATION = 40; // 40% (rewards, staking, airdrops)
    uint256 public constant LIQUIDITY_ALLOCATION = 15; // 15%
    uint256 public constant RESERVE_ALLOCATION = 5; // 5%
    
    mapping(address => bool) public authorizedMinters;
    uint256 public totalMinted;
    
    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);
    
    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    constructor() ERC20("VAULT", "VAULT") {
        // Mint initial supply to contract
        _mint(address(this), INITIAL_SUPPLY);
        totalMinted = INITIAL_SUPPLY;
        
        // Distribute initial supply
        // Team (vested - handled separately)
        _transfer(address(this), msg.sender, (INITIAL_SUPPLY * TEAM_ALLOCATION) / 100);
        
        // Treasury
        // Community rewards pool
        // Liquidity (DEX)
        // Reserve
    }
    
    /**
     * @dev Mint additional tokens (up to max supply)
     * Only for authorized minters (staking rewards, incentives)
     */
    function mint(address to, uint256 amount) external onlyAuthorizedMinter {
        require(totalMinted + amount <= MAX_SUPPLY, "Max supply reached");
        totalMinted += amount;
        _mint(to, amount);
    }
    
    /**
     * @dev Authorize a contract to mint tokens
     */
    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }
    
    /**
     * @dev Revoke minter authorization
     */
    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }
    
    /**
     * @dev Get remaining mintable supply
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }
}
