// TCG Vault Protocol - Web3 Integration
// Contract addresses will be loaded from deployed-addresses.json

// Contract ABIs (minimal for UI functionality)
const ABIs = {
    VAULTToken: [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address, uint256) returns (bool)",
        "function allowance(address, address) view returns (uint256)",
        "function mint(address, uint256)",
        "function authorizeMinter(address)",
        "function authorizedMinters(address) view returns (bool)",
        "function totalMinted() view returns (uint256)",
        "function MAX_SUPPLY() view returns (uint256)",
        "function remainingSupply() view returns (uint256)",
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Approval(address indexed owner, address indexed spender, uint256 value)"
    ],
    eVAULTToken: [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address, uint256) returns (bool)",
        "function allowance(address, address) view returns (uint256)",
        "function mint(address, uint256)",
        "function burn(address, uint256)",
        "function burnFrom(address, uint256)",
        "function authorizeMinter(address)",
        "function authorizeSpender(address)",
        "function authorizedMinters(address) view returns (bool)",
        "function authorizedSpenders(address) view returns (bool)",
        "function canReceiveEVAULT(address) view returns (bool)",
        "function pause()",
        "function unpause()",
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event MinterAuthorized(address indexed minter)",
        "event SpenderAuthorized(address indexed spender)"
    ],
    VAULTStaking: [
        "function stake(uint8 tier, uint256 amount)",
        "function unstake(uint256 stakeIndex)",
        "function emergencyUnstake(uint256 stakeIndex)",
        "function claimRewards()",
        "function calculatePendingRewards(address) view returns (uint256)",
        "function getStakeInfo(address, uint256) view returns (uint256 amount, uint256 stakedAt, uint256 unlockTime, uint8 tier, uint256 lastClaimWeek, uint256 pendingRewards)",
        "function getStakeCount(address) view returns (uint256)",
        "function totalActiveWeight() view returns (uint256)",
        "function eVAULTPerUsd() view returns (uint256)",
        "function currentWeek() view returns (uint256)",
        "function treasuryWallet() view returns (address)",
        "function setTreasuryWallet(address)",
        "function updateTierConfig(uint8 tier, uint256 weight, uint256 rewardMultiplier, uint256 lockPeriod)",
        "event Staked(address indexed user, uint256 indexed stakeIndex, uint256 amount, uint8 tier)",
        "event Unstaked(address indexed user, uint256 indexed stakeIndex, uint256 amount)",
        "event RewardsClaimed(address indexed user, uint256 amount)",
        "event EmergencyUnstake(address indexed user, uint256 indexed stakeIndex, uint256 amount, uint256 penalty)"
    ],
    RewardsPool: [
        "function depositRevenue(address token, uint256 amount)",
        "function adminDeposit(address token, uint256 amount)",
        "function distributeWeeklyPool()",
        "function claimRewardsForStakers()",
        "function addSupportedToken(address token, uint256 usdRate)",
        "function setStakingContract(address)",
        "function tokenPools(address) view returns (uint256 totalDeposited, uint256 normalizedUsd)",
        "function weeklyPools(uint256 week) view returns (uint256 totalUsdValue, uint256 distributed)",
        "function currentWeek() view returns (uint256)",
        "function stakingContract() view returns (address)",
        "function protocol() view returns (address)",
        "function supportedTokens(address) view returns (bool)",
        "function getSupportedTokens() view returns (address[])",
        "event RevenueDeposited(address indexed token, uint256 amount, uint256 normalizedUsd)",
        "event WeeklyPoolDistributed(uint256 indexed week, uint256 totalUsdValue)",
        "event RewardsClaimed(uint256 indexed week, uint256 amount)"
    ],
    TCGVaultProtocol: [
        "function addSupportedToken(address token)",
        "function removeSupportedToken(address token)",
        "function supportedTokens(address) view returns (bool)",
        "function addCard(uint256 cardId, string name, string cardRef, uint256 vaultValue, uint256 totalShares, uint256 buyoutValue)",
        "function cards(uint256) view returns (string name, string cardId, uint256 vaultValue, uint256 totalShares, uint256 availableShares, uint256 buyoutValue, bool active)",
        "function purchaseShares(address paymentToken, uint256 cardId, uint256 shares)",
        "function purchaseSharesWithEVAULT(uint256 cardId, uint256 shares)",
        "function purchaseBreakPacks(address paymentToken, uint256 breakId, uint256 quantity, uint256 packPrice)",
        "function purchaseBreakPacksWithEVAULT(uint256 breakId, uint256 quantity, uint256 packPrice)",
        "function createPreSale(uint256 preSaleId, uint256 openDate, uint256 closeDate, uint256 packPrice, uint256 packsAvailable, address paymentToken)",
        "function purchasePreSale(uint256 preSaleId, uint256 quantity)",
        "function claimPreSaleRefund(uint256 preSaleId)",
        "function acquireInventory(uint256 preSaleId, uint256 amountPaid)",
        "function convertPreSaleToBreak(uint256 preSaleId, uint256 breakId)",
        "function proposeBuyout(address paymentToken, uint256 cardId)",
        "function voteOnBuyout(uint256 cardId, bool approve)",
        "function executeBuyout(uint256 cardId)",
        "function claimBuyoutPayout(uint256 cardId)",
        "function userOwnership(uint256, address) view returns (uint256 sharesOwned, uint256 lastPurchaseTime)",
        "function buyoutProposals(uint256) view returns (uint256 cardId, uint256 offerValue, uint256 votesFor, uint256 votesAgainst, uint256 deadline, bool executed, address paymentToken)",
        "function preSales(uint256) view returns (uint256 openDate, uint256 closeDate, uint256 packPrice, uint256 packsAvailable, uint256 packsSold, uint256 fundsRaised, address paymentToken, bool isLive, bool cancelled, bool inventoryAcquired)",
        "function setEVAULTToken(address)",
        "function setRewardsPool(address)",
        "function setInventoryFundWallet(address)",
        "function treasuryWallet() view returns (address)",
        "function operationsWallet() view returns (address)",
        "function tokenLiquidityWallet() view returns (address)",
        "function investmentWallet() view returns (address)",
        "function inventoryFundWallet() view returns (address)",
        "function eVAULTToken() view returns (address)",
        "function rewardsPool() view returns (address)",
        "function pause()",
        "function unpause()",
        "function emergencyWithdraw(address token, uint256 amount)",
        "event CardAdded(uint256 indexed cardId, string name, uint256 vaultValue, uint256 totalShares)",
        "event SharesPurchased(address indexed buyer, uint256 indexed cardId, uint256 shares, uint256 totalCost)",
        "event BreakPurchase(address indexed buyer, uint256 indexed breakId, uint256 quantity, uint256 totalRevenue, uint256 packCost, uint256 profit)",
        "event BuyoutProposed(uint256 indexed cardId, uint256 offerValue, uint256 deadline)",
        "event VoteCast(address indexed voter, uint256 indexed cardId, bool approved, uint256 weight)",
        "event BuyoutExecuted(uint256 indexed cardId, uint256 totalPaid)",
        "event PayoutDistributed(uint256 indexed cardId, address indexed recipient, uint256 amount)"
    ],
    // Standard ERC20 ABI for USDC/USDT
    ERC20: [
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)",
        "function transferFrom(address, address, uint256) returns (bool)",
        "function approve(address, uint256) returns (bool)",
        "function allowance(address, address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Approval(address indexed owner, address indexed spender, uint256 value)"
    ]
};

// BSC Mainnet USDC/USDT addresses
const BSC_TOKENS = {
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97b32Cd580d", // BSC-USD
    USDT: "0x55d398326f99059fF775485246999027B3197955"
};

// Contract addresses (populated from deployed-addresses.json)
let CONTRACT_ADDRESSES = {};

// Provider and signer
let provider = null;
let signer = null;

// Contract instances
let contracts = {
    vaultToken: null,
    eVAULT: null,
    staking: null,
    rewardsPool: null,
    protocol: null,
    usdc: null,
    usdt: null
};

// User state
let userAddress = null;
let userBalances = {
    vault: 0,
    evault: 0,
    usdc: 0,
    usdt: 0
};

/**
 * Initialize Web3 connection
 */
async function initWeb3() {
    // Load contract addresses
    await loadContractAddresses();
    
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.providers.Web3Provider(window.ethereum, "any");
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
        
        return true;
    } else {
        console.error('MetaMask not installed');
        showNotification('Please install MetaMask to use this dApp', 'error');
        return false;
    }
}

/**
 * Load contract addresses from deployed-addresses.json
 */
async function loadContractAddresses() {
    try {
        const response = await fetch('deployed-addresses.json');
        if (response.ok) {
            const data = await response.json();
            CONTRACT_ADDRESSES = {
                vaultToken: data.vaultToken,
                eVAULT: data.eVAULT,
                staking: data.staking,
                rewardsPool: data.rewardsPool,
                protocol: data.protocol,
                usdc: data.usdc || BSC_TOKENS.USDC,
                usdt: data.usdt || BSC_TOKENS.USDT
            };
        } else {
            // Fallback to hardcoded test addresses if file not found
            console.warn('deployed-addresses.json not found, using fallback');
        }
    } catch (error) {
        console.warn('Error loading addresses:', error);
    }
}

/**
 * Connect wallet
 */
async function connectWallet() {
    if (!provider) {
        const initialized = await initWeb3();
        if (!initialized) return false;
    }
    
    try {
        // Request account access
        await provider.send("eth_requestAccounts", []);
        
        // Get signer
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        
        // Initialize contracts
        await initContracts();
        
        // Update UI
        updateWalletUI();
        
        // Load user balances
        await loadUserBalances();
        
        // Start balance polling
        startBalancePolling();
        
        showNotification('Wallet connected!', 'success');
        return true;
    } catch (error) {
        console.error('Connection error:', error);
        showNotification('Failed to connect wallet', 'error');
        return false;
    }
}

/**
 * Initialize contract instances
 */
async function initContracts() {
    if (!signer) return;
    
    contracts.vaultToken = new ethers.Contract(
        CONTRACT_ADDRESSES.vaultToken,
        ABIs.VAULTToken,
        signer
    );
    
    contracts.eVAULT = new ethers.Contract(
        CONTRACT_ADDRESSES.eVAULT,
        ABIs.eVAULTToken,
        signer
    );
    
    contracts.staking = new ethers.Contract(
        CONTRACT_ADDRESSES.staking,
        ABIs.VAULTStaking,
        signer
    );
    
    contracts.rewardsPool = new ethers.Contract(
        CONTRACT_ADDRESSES.rewardsPool,
        ABIs.RewardsPool,
        signer
    );
    
    contracts.protocol = new ethers.Contract(
        CONTRACT_ADDRESSES.protocol,
        ABIs.TCGVaultProtocol,
        signer
    );
    
    contracts.usdc = new ethers.Contract(
        CONTRACT_ADDRESSES.usdc,
        ABIs.ERC20,
        signer
    );
    
    contracts.usdt = new ethers.Contract(
        CONTRACT_ADDRESSES.usdt,
        ABIs.ERC20,
        signer
    );
}

/**
 * Handle account changes
 */
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // Wallet disconnected
        userAddress = null;
        signer = null;
        updateWalletUI();
        showNotification('Wallet disconnected', 'info');
    } else {
        // Account changed
        userAddress = accounts[0];
        connectWallet();
    }
}

/**
 * Update wallet UI elements
 */
function updateWalletUI() {
    const walletBtn = document.getElementById('connect-wallet-btn');
    const walletAddress = document.getElementById('wallet-address');
    
    if (walletBtn) {
        if (userAddress) {
            walletBtn.textContent = 'Connected';
            walletBtn.classList.add('connected');
        } else {
            walletBtn.textContent = 'Connect Wallet';
            walletBtn.classList.remove('connected');
        }
    }
    
    if (walletAddress) {
        walletAddress.textContent = userAddress 
            ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` 
            : 'Not connected';
    }
}

/**
 * Load user token balances
 */
async function loadUserBalances() {
    if (!userAddress || !contracts.vaultToken) return;
    
    try {
        const [vault, evault, usdc, usdt] = await Promise.all([
            contracts.vaultToken.balanceOf(userAddress),
            contracts.eVAULT.balanceOf(userAddress),
            contracts.usdc.balanceOf(userAddress),
            contracts.usdt.balanceOf(userAddress)
        ]);
        
        userBalances = {
            vault: parseFloat(ethers.utils.formatEther(vault)),
            evault: parseFloat(ethers.utils.formatEther(evault)),
            usdc: parseFloat(ethers.utils.formatUnits(usdc, 18)),
            usdt: parseFloat(ethers.utils.formatUnits(usdt, 18))
        };
        
        // Update balance displays
        updateBalanceDisplays();
    } catch (error) {
        console.error('Error loading balances:', error);
    }
}

/**
 * Update balance display elements
 */
function updateBalanceDisplays() {
    const elements = {
        'vault-balance': userBalances.vault.toFixed(2),
        'evault-balance': userBalances.evault.toFixed(2),
        'usdc-balance': userBalances.usdc.toFixed(2),
        'usdt-balance': userBalances.usdt.toFixed(2)
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

/**
 * Start polling for balance updates
 */
function startBalancePolling() {
    setInterval(loadUserBalances, 15000); // Every 15 seconds
}

/**
 * ==================== STAKING FUNCTIONS ====================
 */

/**
 * Stake VAULT tokens
 */
async function stakeTokens(tier, amount) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const amountWei = ethers.utils.parseEther(amount.toString());
        
        // First approve staking contract to spend VAULT
        const approveTx = await contracts.vaultToken.approve(
            CONTRACT_ADDRESSES.staking,
            amountWei
        );
        await approveTx.wait();
        
        // Then stake
        const stakeTx = await contracts.staking.stake(tier, amountWei);
        await stakeTx.wait();
        
        showNotification('Stake successful!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Stake error:', error);
        showNotification('Stake failed: ' + error.message, 'error');
    }
}

/**
 * Unstake tokens
 */
async function unstake(stakeIndex) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const tx = await contracts.staking.unstake(stakeIndex);
        await tx.wait();
        
        showNotification('Unstake successful!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Unstake error:', error);
        showNotification('Unstake failed: ' + error.message, 'error');
    }
}

/**
 * Emergency unstake (with penalty)
 */
async function emergencyUnstake(stakeIndex) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const tx = await contracts.staking.emergencyUnstake(stakeIndex);
        await tx.wait();
        
        showNotification('Emergency unstake successful!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Emergency unstake error:', error);
        showNotification('Emergency unstake failed: ' + error.message, 'error');
    }
}

/**
 * Claim staking rewards
 */
async function claimRewards() {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const tx = await contracts.staking.claimRewards();
        await tx.wait();
        
        showNotification('Rewards claimed!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Claim error:', error);
        showNotification('Claim failed: ' + error.message, 'error');
    }
}

/**
 * Get pending rewards
 */
async function getPendingRewards() {
    if (!userAddress || !contracts.staking) return 0;
    
    try {
        const rewards = await contracts.staking.calculatePendingRewards(userAddress);
        return parseFloat(ethers.utils.formatEther(rewards));
    } catch (error) {
        console.error('Error getting pending rewards:', error);
        return 0;
    }
}

/**
 * Get user's stakes
 */
async function getUserStakes() {
    if (!userAddress || !contracts.staking) return [];
    
    try {
        const count = await contracts.staking.getStakeCount(userAddress);
        const stakes = [];
        
        for (let i = 0; i < count; i++) {
            const stake = await contracts.staking.getStakeInfo(userAddress, i);
            stakes.push({
                index: i,
                amount: parseFloat(ethers.utils.formatEther(stake.amount)),
                stakedAt: new Date(stake.stakedAt.toNumber() * 1000),
                unlockTime: new Date(stake.unlockTime.toNumber() * 1000),
                tier: stake.tier,
                lastClaimWeek: stake.lastClaimWeek.toNumber()
            });
        }
        
        return stakes;
    } catch (error) {
        console.error('Error getting stakes:', error);
        return [];
    }
}

/**
 * ==================== ORDER TRACKING FUNCTIONS ====================
 */

/**
 * Get order details by ID
 */
async function getOrder(orderId) {
    if (!contracts.protocol) return null;
    
    try {
        const order = await contracts.protocol.getOrder(orderId);
        const breakType = await contracts.protocol.breakTypes(order.breakId);
        
        return {
            orderId: order.id.toNumber(),
            buyer: order.buyer,
            buyerLast5: order.buyer.slice(-5),
            breakId: order.breakId.toNumber(),
            breakName: breakType.name,
            quantity: order.quantity.toNumber(),
            totalPaid: parseFloat(ethers.utils.formatEther(order.totalPaid)),
            timestamp: new Date(order.timestamp.toNumber() * 1000),
            fulfilled: order.fulfilled
        };
    } catch (error) {
        console.error('Error getting order:', error);
        return null;
    }
}

/**
 * Get recent orders for dashboard analytics
 */
async function getRecentOrders(count = 10) {
    if (!contracts.protocol) return [];
    
    try {
        const orderIds = await contracts.protocol.getRecentOrders(count);
        const orders = [];
        
        for (const id of orderIds) {
            const order = await getOrder(id);
            if (order) orders.push(order);
        }
        
        return orders;
    } catch (error) {
        console.error('Error getting recent orders:', error);
        return [];
    }
}

/**
 * Get user's orders
 */
async function getUserOrders() {
    if (!userAddress || !contracts.protocol) return [];
    
    try {
        const orderIds = await contracts.protocol.getUserOrders(userAddress);
        const orders = [];
        
        for (const id of orderIds) {
            const order = await getOrder(id);
            if (order) orders.push(order);
        }
        
        return orders.reverse(); // Most recent first
    } catch (error) {
        console.error('Error getting user orders:', error);
        return [];
    }
}

/**
 * Get total order count
 */
async function getTotalOrders() {
    if (!contracts.protocol) return 0;
    
    try {
        const count = await contracts.protocol.orderCount();
        return count.toNumber();
    } catch (error) {
        console.error('Error getting total orders:', error);
        return 0;
    }
}

/**
 * ==================== PRE-SALE FUNCTIONS ====================
 */

/**
 * Get pre-sale details by ID
 */
async function getPreSale(preSaleId) {
    if (!contracts.protocol) return null;
    
    try {
        const sale = await contracts.protocol.getPreSale(preSaleId);
        const totalPacks = sale.packsAvailable.toNumber();
        const soldPacks = sale.packsSold.toNumber();
        
        return {
            preSaleId: preSaleId,
            name: sale.name,
            productType: sale.productType,
            packsAvailable: totalPacks,
            packsSold: soldPacks,
            packsRemaining: totalPacks - soldPacks,
            packPrice: parseFloat(ethers.utils.formatEther(sale.packPrice)),
            targetInventoryCost: parseFloat(ethers.utils.formatEther(sale.targetInventoryCost)),
            fundsRaised: parseFloat(ethers.utils.formatEther(sale.fundsRaised)),
            paymentToken: sale.paymentToken,
            openDate: new Date(sale.openDate.toNumber() * 1000),
            inventoryAcquired: sale.inventoryAcquired,
            isLive: sale.isLive,
            cancelled: sale.cancelled,
            percentSold: totalPacks > 0 ? Math.round((soldPacks / totalPacks) * 100) : 0
        };
    } catch (error) {
        console.error('Error getting pre-sale:', error);
        return null;
    }
}

/**
 * Get all active pre-sales
 */
async function getActivePreSales() {
    if (!contracts.protocol) return [];
    
    try {
        // Get preSaleCount from contract
        const count = await contracts.protocol.preSaleCount();
        const preSales = [];
        
        for (let i = 1; i <= count.toNumber(); i++) {
            const sale = await getPreSale(i);
            if (sale && !sale.isLive && !sale.cancelled && sale.packsRemaining > 0) {
                preSales.push(sale);
            }
        }
        
        return preSales;
    } catch (error) {
        console.error('Error getting active pre-sales:', error);
        return [];
    }
}

/**
 * Purchase packs in a pre-sale
 */
async function purchasePreSale(preSaleId, quantity, paymentToken) {
    if (!userAddress || !contracts.protocol) {
        return { success: false, error: 'Not connected' };
    }
    
    try {
        // First approve tokens
        const sale = await getPreSale(preSaleId);
        const totalCost = ethers.utils.parseEther((sale.packPrice * quantity).toString());
        
        const tokenContract = new ethers.Contract(
            paymentToken,
            ['function approve(address spender, uint256 amount) public returns (bool)'],
            signer
        );
        
        const approveTx = await tokenContract.approve(contracts.protocol.address, totalCost);
        await approveTx.wait();
        
        // Purchase pre-sale
        const tx = await contracts.protocol.purchasePreSale(preSaleId, quantity);
        const receipt = await tx.wait();
        
        return {
            success: true,
            transactionHash: receipt.transactionHash,
            preSaleId,
            quantity,
            totalCost: sale.packPrice * quantity
        };
    } catch (error) {
        console.error('Error purchasing pre-sale:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user's pre-sale purchase amount
 */
async function getUserPreSalePurchase(preSaleId) {
    if (!userAddress || !contracts.protocol) return 0;
    
    try {
        const amount = await contracts.protocol.getUserPreSalePurchase(preSaleId, userAddress);
        return amount.toNumber();
    } catch (error) {
        console.error('Error getting user pre-sale purchase:', error);
        return 0;
    }
}

/**
 * ==================== MARKETPLACE FUNCTIONS ====================
 */

/**
 * Get all break types from contract
 */
async function getBreakTypes() {
    if (!contracts.protocol) return [];
    
    try {
        const count = await contracts.protocol.breakTypeCount();
        const breakTypes = [];
        
        for (let i = 0; i < count; i++) {
            const bt = await contracts.protocol.breakTypes(i);
            if (bt.active) {
                breakTypes.push({
                    id: i,
                    name: bt.name,
                    packCost: parseFloat(ethers.utils.formatEther(bt.packCost)),
                    packPrice: parseFloat(ethers.utils.formatEther(bt.packPrice)),
                    active: bt.active
                });
            }
        }
        
        return breakTypes;
    } catch (error) {
        console.error('Error getting break types:', error);
        return [];
    }
}

/**
 * Purchase break packs with stablecoin
 */
async function purchaseBreakPacks(breakId, quantity, paymentToken) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        // Get break type info to determine pack price
        const breakType = await contracts.protocol.breakTypes(breakId);
        const packPrice = breakType.packPrice;
        
        const token = paymentToken === 'USDC' ? contracts.usdc : contracts.usdt;
        const tokenAddress = paymentToken === 'USDC' ? CONTRACT_ADDRESSES.usdc : CONTRACT_ADDRESSES.usdt;
        
        const totalCost = packPrice.mul(quantity);
        
        // Approve protocol to spend tokens
        const approveTx = await token.approve(CONTRACT_ADDRESSES.protocol, totalCost);
        await approveTx.wait();
        
        // Purchase (packPrice comes from contract now)
        const tx = await contracts.protocol.purchaseBreakPacks(
            tokenAddress,
            breakId,
            quantity
        );
        await tx.wait();
        
        showNotification('Purchase successful!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Purchase error:', error);
        showNotification('Purchase failed: ' + error.message, 'error');
    }
}

/**
 * Purchase break packs with eVAULT (with discount)
 */
async function purchaseBreakPacksWithEVAULT(breakId, quantity) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        // Get break type info to determine pack price
        const breakType = await contracts.protocol.breakTypes(breakId);
        const packPrice = breakType.packPrice;
        
        const totalCost = packPrice.mul(quantity);
        
        // Approve protocol to spend eVAULT
        const approveTx = await contracts.eVAULT.approve(
            CONTRACT_ADDRESSES.protocol,
            totalCost
        );
        await approveTx.wait();
        
        // Purchase (packPrice comes from contract now)
        const tx = await contracts.protocol.purchaseBreakPacksWithEVAULT(
            breakId,
            quantity
        );
        await tx.wait();
        
        showNotification('eVAULT purchase successful!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('eVAULT purchase error:', error);
        showNotification('eVAULT purchase failed: ' + error.message, 'error');
    }
}

/**
 * ==================== VAULT FUNCTIONS (Fractional Ownership) ====================
 */

/**
 * Purchase card shares with stablecoin
 */
async function purchaseShares(cardId, shares, paymentToken) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const token = paymentToken === 'USDC' ? contracts.usdc : contracts.usdt;
        const tokenAddress = paymentToken === 'USDC' ? CONTRACT_ADDRESSES.usdc : CONTRACT_ADDRESSES.usdt;
        
        // Get share price from card info
        const card = await contracts.protocol.cards(cardId);
        const sharePrice = card.vaultValue.div(card.totalShares);
        const totalCost = sharePrice.mul(shares);
        
        // Approve protocol to spend tokens
        const approveTx = await token.approve(CONTRACT_ADDRESSES.protocol, totalCost);
        await approveTx.wait();
        
        // Purchase
        const tx = await contracts.protocol.purchaseShares(tokenAddress, cardId, shares);
        await tx.wait();
        
        showNotification('Shares purchased!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Purchase shares error:', error);
        showNotification('Purchase failed: ' + error.message, 'error');
    }
}

/**
 * Purchase card shares with eVAULT (with discount)
 */
async function purchaseSharesWithEVAULT(cardId, shares) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        // Get share price from card info
        const card = await contracts.protocol.cards(cardId);
        const sharePrice = card.vaultValue.div(card.totalShares);
        const totalCost = sharePrice.mul(shares);
        
        // Approve protocol to spend eVAULT
        const approveTx = await contracts.eVAULT.approve(
            CONTRACT_ADDRESSES.protocol,
            totalCost
        );
        await approveTx.wait();
        
        // Purchase
        const tx = await contracts.protocol.purchaseSharesWithEVAULT(cardId, shares);
        await tx.wait();
        
        showNotification('eVAULT shares purchased!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('eVAULT shares error:', error);
        showNotification('Purchase failed: ' + error.message, 'error');
    }
}

/**
 * Get user's shares for a card
 */
async function getUserShares(cardId) {
    if (!userAddress || !contracts.protocol) return 0;
    
    try {
        const ownership = await contracts.protocol.userOwnership(cardId, userAddress);
        return ownership.sharesOwned.toNumber();
    } catch (error) {
        console.error('Error getting user shares:', error);
        return 0;
    }
}

/**
 * ==================== BUYOUT FUNCTIONS ====================
 */

/**
 * Propose a buyout for a card
 */
async function proposeBuyout(cardId, paymentToken) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const token = paymentToken === 'USDC' ? contracts.usdc : contracts.usdt;
        const tokenAddress = paymentToken === 'USDC' ? CONTRACT_ADDRESSES.usdc : CONTRACT_ADDRESSES.usdt;
        
        // Get buyout value
        const card = await contracts.protocol.cards(cardId);
        const buyoutValue = card.buyoutValue;
        
        // Approve protocol to spend tokens
        const approveTx = await token.approve(CONTRACT_ADDRESSES.protocol, buyoutValue);
        await approveTx.wait();
        
        // Propose
        const tx = await contracts.protocol.proposeBuyout(tokenAddress, cardId);
        await tx.wait();
        
        showNotification('Buyout proposed!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Propose buyout error:', error);
        showNotification('Propose failed: ' + error.message, 'error');
    }
}

/**
 * Vote on buyout
 */
async function voteOnBuyout(cardId, approve) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const tx = await contracts.protocol.voteOnBuyout(cardId, approve);
        await tx.wait();
        
        showNotification(`Vote ${approve ? 'for' : 'against'} buyout cast!`, 'success');
    } catch (error) {
        console.error('Vote error:', error);
        showNotification('Vote failed: ' + error.message, 'error');
    }
}

/**
 * Claim buyout payout
 */
async function claimBuyoutPayout(cardId) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const tx = await contracts.protocol.claimBuyoutPayout(cardId);
        await tx.wait();
        
        showNotification('Payout claimed!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Claim payout error:', error);
        showNotification('Claim failed: ' + error.message, 'error');
    }
}

/**
 * ==================== PRE-SALE FUNCTIONS ====================
 */

/**
 * Purchase pre-sale packs
 */
async function purchasePreSale(preSaleId, quantity) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        // Get pre-sale info
        const preSale = await contracts.protocol.preSales(preSaleId);
        const totalCost = preSale.packPrice.mul(quantity);
        
        // Determine token
        const tokenAddress = preSale.paymentToken;
        const token = tokenAddress === CONTRACT_ADDRESSES.usdc ? contracts.usdc : contracts.usdt;
        
        // Approve protocol to spend tokens
        const approveTx = await token.approve(CONTRACT_ADDRESSES.protocol, totalCost);
        await approveTx.wait();
        
        // Purchase
        const tx = await contracts.protocol.purchasePreSale(preSaleId, quantity);
        await tx.wait();
        
        showNotification('Pre-sale purchase successful!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Pre-sale purchase error:', error);
        showNotification('Purchase failed: ' + error.message, 'error');
    }
}

/**
 * Claim pre-sale refund (if cancelled)
 */
async function claimPreSaleRefund(preSaleId) {
    if (!signer) {
        showNotification('Please connect wallet first', 'error');
        return;
    }
    
    try {
        const tx = await contracts.protocol.claimPreSaleRefund(preSaleId);
        await tx.wait();
        
        showNotification('Refund claimed!', 'success');
        await loadUserBalances();
    } catch (error) {
        console.error('Refund error:', error);
        showNotification('Refund failed: ' + error.message, 'error');
    }
}

/**
 * ==================== UTILITY FUNCTIONS ====================
 */

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Check if notification function exists from script.js
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    }
}

/**
 * Get ETH balance
 */
async function getEthBalance() {
    if (!userAddress || !provider) return 0;
    
    try {
        const balance = await provider.getBalance(userAddress);
        return parseFloat(ethers.utils.formatEther(balance));
    } catch (error) {
        console.error('Error getting ETH balance:', error);
        return 0;
    }
}

/**
 * Check if user is on BSC
 */
async function checkNetwork() {
    if (!provider) return false;
    
    const network = await provider.getNetwork();
    const bscMainnet = 56;
    const bscTestnet = 97;
    
    if (network.chainId !== bscMainnet && network.chainId !== bscTestnet) {
        showNotification('Please switch to BSC network', 'error');
        return false;
    }
    
    return true;
}

/**
 * Switch to BSC network
 */
async function switchToBSC() {
    if (!window.ethereum) return;
    
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }] // BSC Mainnet
        });
    } catch (error) {
        // If network doesn't exist, add it
        if (error.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x38',
                    chainName: 'Binance Smart Chain',
                    nativeCurrency: {
                        name: 'BNB',
                        symbol: 'BNB',
                        decimals: 18
                    },
                    rpcUrls: ['https://bsc-dataseed.binance.org/'],
                    blockExplorerUrls: ['https://bscscan.com/']
                }]
            });
        }
    }
}

// Export functions for use in other scripts
window.TCGWeb3 = {
    initWeb3,
    connectWallet,
    loadUserBalances,
    stakeTokens,
    unstake,
    emergencyUnstake,
    claimRewards,
    getPendingRewards,
    getUserStakes,
    getBreakTypes,
    getOrder,
    getRecentOrders,
    getUserOrders,
    getTotalOrders,
    getPreSale,
    getActivePreSales,
    purchasePreSale,
    getUserPreSalePurchase,
    purchaseBreakPacks,
    purchaseBreakPacksWithEVAULT,
    purchaseShares,
    purchaseSharesWithEVAULT,
    getUserShares,
    proposeBuyout,
    voteOnBuyout,
    claimBuyoutPayout,
    claimPreSaleRefund,
    formatNumber,
    checkNetwork,
    switchToBSC,
    getEthBalance,
    contracts: () => contracts,
    userAddress: () => userAddress,
    userBalances: () => userBalances
};
