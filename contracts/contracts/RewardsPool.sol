// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title RewardsPool
 * @dev Contract that accumulates break revenue and distributes to stakers weekly
 * Receives revenue from TCGVaultProtocol and allows VAULTStaking to claim for distribution
 */
contract RewardsPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ STATE VARIABLES ============
    
    // Supported revenue tokens (USDC, USDT)
    mapping(address => bool) public supportedTokens;
    
    // List of supported tokens for iteration
    address[] public supportedTokenList;
    
    // Accumulated rewards per token
    mapping(address => uint256) public tokenPools;
    
    // Weekly pool tracking
    struct WeeklyPool {
        uint256 startTime;
        uint256 endTime;
        mapping(address => uint256) tokenAmounts; // token => amount
        uint256 totalUsdValue; // Normalized USD value
        bool distributed;
    }
    
    mapping(uint256 => WeeklyPool) public weeklyPools;
    uint256 public currentWeek;
    uint256 public weekStartDay = 4; // Thursday (0=Sunday, 4=Thursday)
    
    // Conversion rates for USD normalization (token decimals to 18 decimals)
    // e.g., USDC (6 decimals) rate would be 10^12 to get to 18 decimals
    mapping(address => uint256) public tokenUsdRates;
    
    // Authorized staking contract
    address public stakingContract;
    
    // Authorized protocol contract that can deposit revenue
    address public protocolContract;
    
    // ============ CONSTANTS ============
    
    uint256 public constant WEEK_DURATION = 7 days;
    
    // ============ EVENTS ============
    
    event RevenueDeposited(
        address indexed token,
        uint256 amount,
        uint256 week,
        uint256 poolShare
    );
    
    event PoolDistributed(
        uint256 indexed week,
        uint256 totalUsdValue,
        address[] tokens
    );
    
    event RewardsClaimedByStaking(
        uint256 indexed week,
        address indexed stakingContract,
        uint256 amount
    );
    
    event TokenUsdRateUpdated(
        address indexed token,
        uint256 rate
    );
    
    // ============ MODIFIERS ============
    
    modifier onlyStaking() {
        require(msg.sender == stakingContract, "Only staking contract");
        _;
    }
    
    modifier onlyProtocol() {
        require(msg.sender == protocolContract, "Only protocol contract");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _protocolContract) {
        require(_protocolContract != address(0), "Invalid protocol address");
        protocolContract = _protocolContract;
        
        // Initialize first week
        currentWeek = 1;
        uint256 firstWeekStart = _getWeekStart(block.timestamp);
        weeklyPools[currentWeek].startTime = firstWeekStart;
        weeklyPools[currentWeek].endTime = firstWeekStart + WEEK_DURATION;
    }
    
    // ============ DEPOSIT FUNCTIONS ============
    
    /**
     * @dev Deposit break revenue into the rewards pool
     * Called by TCGVaultProtocol when break packs are purchased
     * @param token The payment token address
     * @param amount Amount to deposit
     */
    function depositRevenue(
        address token,
        uint256 amount
    ) external onlyProtocol nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        
        // Transfer tokens from protocol
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Check if we need to start a new week
        _checkAndStartNewWeek();
        
        // Add to current week's pool
        WeeklyPool storage pool = weeklyPools[currentWeek];
        pool.tokenAmounts[token] += amount;
        tokenPools[token] += amount;
        
        // Calculate normalized USD value
        uint256 normalizedAmount = amount * tokenUsdRates[token];
        pool.totalUsdValue += normalizedAmount;
        
        emit RevenueDeposited(token, amount, currentWeek, normalizedAmount);
    }
    
    /**
     * @dev Deposit without protocol authorization (admin/fallback)
     */
    function adminDeposit(
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        _checkAndStartNewWeek();
        
        WeeklyPool storage pool = weeklyPools[currentWeek];
        pool.tokenAmounts[token] += amount;
        tokenPools[token] += amount;
        
        uint256 normalizedAmount = amount * tokenUsdRates[token];
        pool.totalUsdValue += normalizedAmount;
        
        emit RevenueDeposited(token, amount, currentWeek, normalizedAmount);
    }
    
    // ============ DISTRIBUTION FUNCTIONS ============
    
    /**
     * @dev Distribute accumulated rewards for a completed week
     * Can be called by anyone to finalize the pool
     */
    function distributeWeeklyPool(uint256 week) external nonReentrant {
        WeeklyPool storage pool = weeklyPools[week];
        require(!pool.distributed, "Already distributed");
        require(block.timestamp >= pool.endTime, "Week not ended");
        require(pool.totalUsdValue > 0, "Empty pool");
        
        pool.distributed = true;
        
        emit PoolDistributed(week, pool.totalUsdValue, _getPoolTokens(week));
    }
    
    /**
     * @dev Allow staking contract to claim rewards for stakers
     * Called by VAULTStaking to get rewards to distribute
     */
    function claimRewardsForStakers(
        address token,
        uint256 amount
    ) external onlyStaking nonReentrant {
        require(stakingContract != address(0), "Staking not set");
        require(supportedTokens[token], "Token not supported");
        require(tokenPools[token] >= amount, "Insufficient pool balance");
        
        tokenPools[token] -= amount;
        
        // Transfer to staking contract for distribution
        IERC20(token).safeTransfer(stakingContract, amount);
        
        emit RewardsClaimedByStaking(currentWeek, stakingContract, amount);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get current week's accumulated pool value
     */
    function getCurrentWeekPool() external view returns (
        uint256 week,
        uint256 startTime,
        uint256 endTime,
        uint256 totalUsdValue,
        bool isActive,
        bool distributed
    ) {
        WeeklyPool storage pool = weeklyPools[currentWeek];
        return (
            currentWeek,
            pool.startTime,
            pool.endTime,
            pool.totalUsdValue,
            block.timestamp >= pool.startTime && block.timestamp < pool.endTime,
            pool.distributed
        );
    }
    
    /**
     * @dev Get pool value for a specific week
     */
    function getWeekPool(uint256 week) external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 totalUsdValue,
        bool distributed
    ) {
        WeeklyPool storage pool = weeklyPools[week];
        return (pool.startTime, pool.endTime, pool.totalUsdValue, pool.distributed);
    }
    
    /**
     * @dev Get token amount in a specific week's pool
     */
    function getWeekTokenAmount(uint256 week, address token) external view returns (uint256) {
        return weeklyPools[week].tokenAmounts[token];
    }
    
    /**
     * @dev Get total accumulated balance for a token
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @dev Calculate how much of the pool a staker tier should receive
     * Called by staking contract to determine reward shares
     */
    function calculateTierShare(
        uint256 week,
        uint256 tierWeight, // e.g., 10000 for base, 20000 for 2x, etc.
        uint256 totalTierWeight // Sum of all active stake tier weights
    ) external view returns (uint256) {
        WeeklyPool storage pool = weeklyPools[week];
        if (pool.totalUsdValue == 0 || totalTierWeight == 0) return 0;
        
        return (pool.totalUsdValue * tierWeight) / totalTierWeight;
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _checkAndStartNewWeek() internal {
        WeeklyPool storage currentPool = weeklyPools[currentWeek];
        
        // If current week has ended, advance through all missed weeks
        while (block.timestamp >= currentPool.endTime) {
            // Distribute previous week if not done
            if (!currentPool.distributed && currentPool.totalUsdValue > 0) {
                currentPool.distributed = true;
                emit PoolDistributed(currentWeek, currentPool.totalUsdValue, _getPoolTokens(currentWeek));
            }
            
            // Start new week
            currentWeek++;
            uint256 newWeekStart = currentPool.endTime;
            
            weeklyPools[currentWeek].startTime = newWeekStart;
            weeklyPools[currentWeek].endTime = newWeekStart + WEEK_DURATION;
            
            // Update currentPool reference for next iteration
            currentPool = weeklyPools[currentWeek];
        }
    }
    
    function _getWeekStart(uint256 timestamp) internal view returns (uint256) {
        // Get the most recent week start (Thursday)
        uint256 daysSinceEpoch = timestamp / 1 days;
        uint256 currentDayOfWeek = ((daysSinceEpoch + 4) % 7); // +4 because Jan 1 1970 was Thursday
        
        uint256 daysToSubtract = currentDayOfWeek;
        return timestamp - (daysToSubtract * 1 days);
    }
    
    function _getPoolTokens(uint256) internal view returns (address[] memory) {
        return supportedTokenList;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function setStakingContract(address _staking) external onlyOwner {
        require(_staking != address(0), "Invalid staking address");
        stakingContract = _staking;
    }
    
    function setProtocolContract(address _protocol) external onlyOwner {
        require(_protocol != address(0), "Invalid protocol address");
        protocolContract = _protocol;
    }
    
    function addSupportedToken(address token, uint256 usdRate) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(!supportedTokens[token], "Already supported");
        
        supportedTokens[token] = true;
        tokenUsdRates[token] = usdRate;
        supportedTokenList.push(token);
    }
    
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }
    
    function updateTokenUsdRate(address token, uint256 rate) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        tokenUsdRates[token] = rate;
        emit TokenUsdRateUpdated(token, rate);
    }
    
    /**
     * @dev Emergency withdraw tokens (admin only)
     * Can only withdraw unsupported tokens (not reward tokens)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        require(!supportedTokens[token], "Cannot withdraw reward tokens");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
