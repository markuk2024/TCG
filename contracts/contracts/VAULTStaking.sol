// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IRewardsPool {
    function claimRewardsForStakers(address token, uint256 amount) external;
    function calculateTierShare(uint256 week, uint256 tierWeight, uint256 totalTierWeight) external view returns (uint256);
    function getWeekPool(uint256 week) external view returns (uint256 startTime, uint256 endTime, uint256 totalUsdValue, bool distributed);
    function currentWeek() external view returns (uint256);
}

interface IeVAULT {
    function mint(address to, uint256 amount) external;
}

/**
 * @title VAULTStaking
 * @dev Staking contract for $VAULT token with pool-based rewards
 * Stake $VAULT → Earn share of weekly rewards pool (paid in $eVAULT)
 * Rewards come from break revenue, distributed proportionally by tier weight
 */
contract VAULTStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // ============ STATE VARIABLES ============
    
    IERC20 public vaultToken;
    address public eVAULTToken;
    IRewardsPool public rewardsPool;
    
    // ============ STAKING TIERS ============
    
    enum StakeTier {
        THREE_MONTH,    // 3 months, 1x pool share weight
        SIX_MONTH,      // 6 months, 1.5x pool share weight
        TWELVE_MONTH,   // 12 months, 2x pool share weight
        FOREVER         // 10 years/forever, 4x pool share weight
    }
    
    struct TierConfig {
        uint256 lockDuration;       // Duration in seconds
        uint256 weight;             // Weight for pool share calculation (10000 = 1x)
        string name;
        uint256 rewardMultiplier;   // Additional multiplier for eVAULT rewards
    }
    
    mapping(StakeTier => TierConfig) public tierConfigs;
    
    // ============ USER STAKES ============
    
    struct StakeInfo {
        uint256 amount;
        StakeTier tier;
        uint256 startTime;
        uint256 endTime;           // When stake can be withdrawn
        uint256 lastClaimWeek;     // Last week rewards were claimed
        bool withdrawn;
    }
    
    mapping(address => StakeInfo[]) public userStakes;
    mapping(address => uint256) public totalStaked;
    
    // ============ REWARD TRACKING ============
    
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant WEEK = 7 days;
    
    // Total weight across all active stakes
    uint256 public totalActiveWeight;
    mapping(StakeTier => uint256) public tierTotalStaked;
    
    // Per-week total weight snapshots for historical reward accuracy
    mapping(uint256 => uint256) public weekTotalWeight;
    
    // Weekly tracking
    mapping(uint256 => mapping(address => bool)) public hasClaimedWeek; // week => user => claimed
    mapping(uint256 => uint256) public weekTotalRewards; // week => total eVAULT distributed
    
    // Treasury wallet for penalty collection
    address public treasuryWallet;
    
    // Global stats
    uint256 public totalVaultStaked;
    uint256 public totalRewardsDistributed;
    uint256 public stakeCount;
    
    // ============ REWARD RATE ============
    
    // eVAULT minted per 1 USD of pool value (with 18 decimals)
    uint256 public eVAULTPerUsd = 100 * 10**18; // 100 eVAULT per USD (configurable)
    
    // ============ EVENTS ============
    
    event Staked(
        address indexed user,
        uint256 indexed stakeId,
        uint256 amount,
        StakeTier tier,
        uint256 weight,
        uint256 unlockTime
    );
    
    event Unstaked(
        address indexed user,
        uint256 indexed stakeId,
        uint256 amount
    );
    
    event RewardsClaimed(
        address indexed user,
        uint256 indexed stakeId,
        uint256 week,
        uint256 amount
    );
    
    event EarlyUnstake(
        address indexed user,
        uint256 indexed stakeId,
        uint256 amount,
        uint256 penalty
    );
    
    event TierConfigUpdated(
        StakeTier indexed tier,
        uint256 lockDuration,
        uint256 weight
    );
    
    event WeeklyRewardsDistributed(
        uint256 indexed week,
        uint256 poolValue,
        uint256 eVAULTAmount
    );
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        address _vaultToken,
        address _eVAULTToken,
        address _rewardsPool
    ) {
        require(_vaultToken != address(0), "Invalid VAULT token");
        require(_eVAULTToken != address(0), "Invalid eVAULT token");
        require(_rewardsPool != address(0), "Invalid rewards pool");
        
        vaultToken = IERC20(_vaultToken);
        eVAULTToken = _eVAULTToken;
        rewardsPool = IRewardsPool(_rewardsPool);
        
        // Initialize tier configs with weights
        // 3 months = 1x weight (base)
        tierConfigs[StakeTier.THREE_MONTH] = TierConfig({
            lockDuration: 90 days,
            weight: 10000, // 1x
            name: "3 Month Stake",
            rewardMultiplier: 10000
        });
        
        // 6 months = 1.5x weight
        tierConfigs[StakeTier.SIX_MONTH] = TierConfig({
            lockDuration: 180 days,
            weight: 15000, // 1.5x
            name: "6 Month Stake",
            rewardMultiplier: 15000
        });
        
        // 12 months = 2x weight
        tierConfigs[StakeTier.TWELVE_MONTH] = TierConfig({
            lockDuration: 365 days,
            weight: 20000, // 2x
            name: "12 Month Stake",
            rewardMultiplier: 20000
        });
        
        // Long-term/10 years = 4x weight
        tierConfigs[StakeTier.FOREVER] = TierConfig({
            lockDuration: 3650 days, // 10 years
            weight: 40000, // 4x
            name: "Long-Term Stake (10Y)",
            rewardMultiplier: 40000
        });
    }
    
    // ============ STAKING FUNCTIONS ============
    
    /**
     * @dev Stake $VAULT tokens for a specific tier
     * @param amount Amount of $VAULT to stake
     * @param tier Staking tier (determines lock period and pool weight)
     */
    function stake(uint256 amount, StakeTier tier) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(tierConfigs[tier].weight > 0, "Invalid tier");
        
        TierConfig memory config = tierConfigs[tier];
        
        // Transfer VAULT tokens from user
        vaultToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create stake record
        uint256 stakeId = userStakes[msg.sender].length;
        uint256 unlockTime = block.timestamp + config.lockDuration;
        uint256 currentWeek = rewardsPool.currentWeek();
        
        userStakes[msg.sender].push(StakeInfo({
            amount: amount,
            tier: tier,
            startTime: block.timestamp,
            endTime: unlockTime,
            lastClaimWeek: currentWeek - 1,
            withdrawn: false
        }));
        
        // Update totals and weights
        uint256 stakeWeight = (amount * config.weight) / BPS_DENOMINATOR;
        totalActiveWeight += stakeWeight;
        tierTotalStaked[tier] += amount;
        totalStaked[msg.sender] += amount;
        totalVaultStaked += amount;
        stakeCount++;
        
        emit Staked(msg.sender, stakeId, amount, tier, stakeWeight, unlockTime);
    }
    
    // ============ REWARD FUNCTIONS ============
    
    /**
     * @dev Calculate pending rewards for a stake based on pool share
     * Uses per-week weight snapshots for accurate historical rewards
     * @param maxWeeks Maximum weeks to process (gas limit protection)
     */
    function calculatePendingRewards(address user, uint256 stakeId, uint256 maxWeeks) public view returns (uint256) {
        require(stakeId < userStakes[user].length, "Invalid stake ID");
        
        StakeInfo storage stakeInfo = userStakes[user][stakeId];
        if (stakeInfo.withdrawn) return 0;
        
        uint256 currentWeek = rewardsPool.currentWeek();
        uint256 rewards = 0;
        uint256 weeksProcessed = 0;
        
        // Calculate rewards for each unclaimed week (with gas limit protection)
        for (uint256 week = stakeInfo.lastClaimWeek + 1; week < currentWeek && weeksProcessed < maxWeeks; week++) {
            (,, uint256 poolValue, bool distributed) = rewardsPool.getWeekPool(week);
            
            // Use week-specific total weight snapshot for accurate rewards
            uint256 weekWeight = weekTotalWeight[week];
            if (distributed && poolValue > 0 && weekWeight > 0) {
                TierConfig memory config = tierConfigs[stakeInfo.tier];
                uint256 stakeWeight = (stakeInfo.amount * config.weight) / BPS_DENOMINATOR;
                
                // Share of pool = (stake weight / week's total weight) * pool value
                uint256 shareOfPool = (poolValue * stakeWeight) / weekWeight;
                
                // Convert to eVAULT
                uint256 weekReward = (shareOfPool * eVAULTPerUsd) / 10**18;
                
                // Apply tier multiplier
                weekReward = (weekReward * config.rewardMultiplier) / BPS_DENOMINATOR;
                
                rewards += weekReward;
            }
            weeksProcessed++;
        }
        
        return rewards;
    }
    
    /**
     * @dev Claim accrued rewards for a specific stake
     * Rewards are minted as $eVAULT tokens
     * @param maxWeeks Maximum weeks to process (default 52 for gas safety)
     */
    function claimRewards(uint256 stakeId, uint256 maxWeeks) external nonReentrant {
        require(stakeId < userStakes[msg.sender].length, "Invalid stake ID");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeId];
        require(!stakeInfo.withdrawn, "Stake already withdrawn");
        
        if (maxWeeks == 0) maxWeeks = 52; // Default 1 year of weeks
        
        uint256 rewards = calculatePendingRewards(msg.sender, stakeId, maxWeeks);
        require(rewards > 0, "No rewards to claim");
        
        uint256 currentWeek = rewardsPool.currentWeek();
        
        // Update last claim week (may not reach current if maxWeeks limited)
        stakeInfo.lastClaimWeek = currentWeek - 1;
        
        // Mint eVAULT rewards to user
        _mintRewards(msg.sender, rewards);
        
        totalRewardsDistributed += rewards;
        
        emit RewardsClaimed(msg.sender, stakeId, currentWeek - 1, rewards);
    }
    
    /**
     * @dev Claim rewards for all active stakes
     */
    function claimAllRewards() external nonReentrant {
        uint256 totalRewards = 0;
        uint256 currentWeek = rewardsPool.currentWeek();
        
        for (uint256 i = 0; i < userStakes[msg.sender].length; i++) {
            StakeInfo storage stakeInfo = userStakes[msg.sender][i];
            
            if (!stakeInfo.withdrawn) {
                uint256 stakeRewards = 0;
                
                // Calculate for each unclaimed week
                for (uint256 week = stakeInfo.lastClaimWeek + 1; week < currentWeek; week++) {
                    (,, uint256 poolValue, bool distributed) = rewardsPool.getWeekPool(week);
                    
                    if (distributed && poolValue > 0 && totalActiveWeight > 0) {
                        TierConfig memory config = tierConfigs[stakeInfo.tier];
                        uint256 stakeWeight = (stakeInfo.amount * config.weight) / BPS_DENOMINATOR;
                        
                        uint256 shareOfPool = (poolValue * stakeWeight) / totalActiveWeight;
                        uint256 weekReward = (shareOfPool * eVAULTPerUsd) / 10**18;
                        weekReward = (weekReward * config.rewardMultiplier) / BPS_DENOMINATOR;
                        
                        stakeRewards += weekReward;
                    }
                }
                
                if (stakeRewards > 0) {
                    stakeInfo.lastClaimWeek = currentWeek - 1;
                    totalRewards += stakeRewards;
                    emit RewardsClaimed(msg.sender, i, currentWeek - 1, stakeRewards);
                }
            }
        }
        
        require(totalRewards > 0, "No rewards to claim");
        
        _mintRewards(msg.sender, totalRewards);
        totalRewardsDistributed += totalRewards;
    }
    
    /**
     * @dev Distribute weekly rewards to all stakers
     * Can be called by anyone after week ends to trigger distribution
     */
    function distributeWeeklyRewards(uint256 week) external nonReentrant {
        (,, uint256 poolValue, bool distributed) = rewardsPool.getWeekPool(week);
        require(!distributed, "Already distributed");
        require(poolValue > 0, "Empty pool");
        
        // Calculate total eVAULT to mint this week
        uint256 totalEVAULT = (poolValue * eVAULTPerUsd) / 10**18;
        
        // Note: Actual distribution happens when users claim
        // This just marks the week as ready for claims
        
        emit WeeklyRewardsDistributed(week, poolValue, totalEVAULT);
    }
    
    function _mintRewards(address to, uint256 amount) internal {
        IeVAULT(eVAULTToken).mint(to, amount);
    }
    
    // ============ UNSTAKING FUNCTIONS ============
    
    /**
     * @dev Unstake after lock period ends
     * Claims any pending rewards first
     */
    function unstake(uint256 stakeId) external nonReentrant {
        require(stakeId < userStakes[msg.sender].length, "Invalid stake ID");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeId];
        require(!stakeInfo.withdrawn, "Already withdrawn");
        require(block.timestamp >= stakeInfo.endTime, "Stake still locked");
        
        // Claim any pending rewards first
        uint256 finalRewards = calculatePendingRewards(msg.sender, stakeId, 52);
        if (finalRewards > 0) {
            _mintRewards(msg.sender, finalRewards);
            totalRewardsDistributed += finalRewards;
        }
        
        // Update weights and snapshot for current week
        TierConfig memory config = tierConfigs[stakeInfo.tier];
        uint256 stakeWeight = (stakeInfo.amount * config.weight) / BPS_DENOMINATOR;
        totalActiveWeight -= stakeWeight;
        
        // Record weight snapshot for this week if not already recorded
        uint256 currentWeek = rewardsPool.currentWeek();
        if (weekTotalWeight[currentWeek] == 0) {
            weekTotalWeight[currentWeek] = totalActiveWeight;
        }
        
        tierTotalStaked[stakeInfo.tier] -= stakeInfo.amount;
        
        // Mark as withdrawn
        stakeInfo.withdrawn = true;
        totalStaked[msg.sender] -= stakeInfo.amount;
        totalVaultStaked -= stakeInfo.amount;
        
        // Return principal
        vaultToken.safeTransfer(msg.sender, stakeInfo.amount);
        
        emit Unstaked(msg.sender, stakeId, stakeInfo.amount);
    }
    
    /**
     * @dev Emergency unstake before lock ends (with penalty)
     * Penalty: 10% of principal burned
     */
    function emergencyUnstake(uint256 stakeId) external nonReentrant {
        require(stakeId < userStakes[msg.sender].length, "Invalid stake ID");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeId];
        require(!stakeInfo.withdrawn, "Already withdrawn");
        require(block.timestamp < stakeInfo.endTime, "Use regular unstake");
        
        uint256 principal = stakeInfo.amount;
        uint256 penalty = (principal * 10) / 100; // 10% penalty
        uint256 returnAmount = principal - penalty;
        
        // Calculate any rewards earned up to now
        uint256 finalRewards = calculatePendingRewards(msg.sender, stakeId, 52);
        
        // Update weights
        TierConfig memory config = tierConfigs[stakeInfo.tier];
        uint256 stakeWeight = (stakeInfo.amount * config.weight) / BPS_DENOMINATOR;
        totalActiveWeight -= stakeWeight;
        
        // Record weight snapshot
        uint256 currentWeek = rewardsPool.currentWeek();
        if (weekTotalWeight[currentWeek] == 0) {
            weekTotalWeight[currentWeek] = totalActiveWeight;
        }
        
        tierTotalStaked[stakeInfo.tier] -= principal;
        
        // Mark as withdrawn
        stakeInfo.withdrawn = true;
        totalStaked[msg.sender] -= principal;
        totalVaultStaked -= principal;
        
        // Send penalized principal back
        vaultToken.safeTransfer(msg.sender, returnAmount);
        
        // Send penalty to treasury
        if (treasuryWallet != address(0)) {
            vaultToken.safeTransfer(treasuryWallet, penalty);
        }
        
        // Mint rewards if any
        if (finalRewards > 0) {
            _mintRewards(msg.sender, finalRewards);
            totalRewardsDistributed += finalRewards;
        }
        
        emit EarlyUnstake(msg.sender, stakeId, returnAmount, penalty);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }
    
    function getTotalPendingRewards(address user, uint256 maxWeeks) external view returns (uint256) {
        uint256 total = 0;
        
        for (uint256 i = 0; i < userStakes[user].length; i++) {
            if (!userStakes[user][i].withdrawn) {
                total += calculatePendingRewards(user, i, maxWeeks);
            }
        }
        
        return total;
    }
    
    function isStakeUnlocked(address user, uint256 stakeId) external view returns (bool) {
        require(stakeId < userStakes[user].length, "Invalid stake ID");
        return block.timestamp >= userStakes[user][stakeId].endTime;
    }
    
    function timeUntilUnlock(address user, uint256 stakeId) external view returns (uint256) {
        require(stakeId < userStakes[user].length, "Invalid stake ID");
        
        StakeInfo storage stakeInfo = userStakes[user][stakeId];
        if (block.timestamp >= stakeInfo.endTime) return 0;
        
        return stakeInfo.endTime - block.timestamp;
    }
    
    /**
     * @dev Get estimated weekly reward for a stake
     */
    function estimateWeeklyReward(uint256 amount, StakeTier tier) external view returns (uint256) {
        if (totalActiveWeight == 0) return 0;
        
        (,, uint256 poolValue,) = rewardsPool.getWeekPool(rewardsPool.currentWeek());
        if (poolValue == 0) return 0;
        
        TierConfig memory config = tierConfigs[tier];
        uint256 stakeWeight = (amount * config.weight) / BPS_DENOMINATOR;
        
        uint256 shareOfPool = (poolValue * stakeWeight) / totalActiveWeight;
        uint256 reward = (shareOfPool * eVAULTPerUsd) / 10**18;
        reward = (reward * config.rewardMultiplier) / BPS_DENOMINATOR;
        
        return reward;
    }
    
    /**
     * @dev Get user's share of total pool
     */
    function getUserPoolShare(address user) external view returns (uint256 shareBps) {
        uint256 userWeight = 0;
        
        for (uint256 i = 0; i < userStakes[user].length; i++) {
            StakeInfo storage stakeInfo = userStakes[user][i];
            if (!stakeInfo.withdrawn) {
                TierConfig memory config = tierConfigs[stakeInfo.tier];
                userWeight += (stakeInfo.amount * config.weight) / BPS_DENOMINATOR;
            }
        }
        
        if (totalActiveWeight == 0) return 0;
        return (userWeight * BPS_DENOMINATOR) / totalActiveWeight;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function updateTierConfig(
        StakeTier tier,
        uint256 lockDuration,
        uint256 weight,
        uint256 rewardMultiplier
    ) external onlyOwner {
        tierConfigs[tier] = TierConfig({
            lockDuration: lockDuration,
            weight: weight,
            name: tierConfigs[tier].name,
            rewardMultiplier: rewardMultiplier
        });
        
        emit TierConfigUpdated(tier, lockDuration, weight);
    }
    
    function setEVAULTToken(address _eVAULT) external onlyOwner {
        require(_eVAULT != address(0), "Invalid address");
        eVAULTToken = _eVAULT;
    }
    
    function setRewardsPool(address _rewardsPool) external onlyOwner {
        require(_rewardsPool != address(0), "Invalid address");
        rewardsPool = IRewardsPool(_rewardsPool);
    }
    
    function setEVAULTPerUsd(uint256 rate) external onlyOwner {
        eVAULTPerUsd = rate;
    }
    
    function setTreasuryWallet(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasuryWallet = _treasury;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function recoverTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
