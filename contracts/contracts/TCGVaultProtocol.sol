// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IeVAULT {
    function burn(address from, uint256 amount) external;
}

/**
 * @title TCGVaultProtocol
 * @dev Smart contract for fractional trading card marketplace on BSC
 * Handles break payments, buyouts, and internal credit tracking
 */
contract TCGVaultProtocol is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // ============ STATE VARIABLES ============
    
    // Revenue distribution wallets
    address public treasuryWallet;
    address public operationsWallet;
    address public tokenLiquidityWallet;
    address public investmentWallet;
    
    // Rewards pool for staking
    address public rewardsPool;
    
    // Pre-sale tracking
    struct PreSale {
        string name;
        string productType;      // e.g., "Ascended Heroes"
        uint256 packsAvailable;
        uint256 packsSold;
        uint256 packPrice;
        uint256 targetInventoryCost;  // Amount needed to acquire inventory
        uint256 fundsRaised;
        address paymentToken;
        uint256 openDate;        // When break will be opened
        bool inventoryAcquired;  // Whether product has been purchased
        bool isLive;             // Whether break is now live
        bool cancelled;
        mapping(address => uint256) userPurchases;  // Track individual purchases for refunds
        mapping(address => bool) hasClaimedRefund;
    }
    
    mapping(uint256 => PreSale) public preSales;
    uint256 public preSaleCount;
    
    // Inventory fund wallet - holds pre-sale funds until inventory purchased
    address public inventoryFundWallet;
    
    // Maximum time to fulfill pre-sale (90 days)
    uint256 public constant MAX_PRE_SALE_DURATION = 90 days;
    
    // Refund window after open date passes (30 days)
    uint256 public constant REFUND_WINDOW = 30 days;
    
    // Revenue split percentages (out of 100)
    uint256 public constant TREASURY_SHARE = 50;
    uint256 public constant OPERATIONS_SHARE = 20;
    uint256 public constant TOKEN_LIQUIDITY_SHARE = 20;
    uint256 public constant INVESTMENT_SHARE = 10;
    
    // Platform fee on buyouts (2.5% = 250 basis points)
    uint256 public constant BUYOUT_FEE_BPS = 250;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Pack cost per unit (in payment token decimals) - default/fallback value
    uint256 public defaultPackCost = 10 * 10**18; // £10 equivalent
    
    // Break types for pack sales
    struct BreakType {
        string name;
        uint256 packCost;      // Cost per pack (for inventory)
        uint256 packPrice;     // Sale price per pack
        bool active;
    }
    
    mapping(uint256 => BreakType) public breakTypes;
    uint256 public breakTypeCount;
    
    // Supported payment tokens (USDC, USDT, eVAULT)
    mapping(address => bool) public supportedTokens;
    
    // eVAULT reward token address
    address public eVAULTToken;
    
    // eVAULT discount rate (e.g., 95 = 5% discount when paying with eVAULT)
    uint256 public eVAULTDiscountBps = 500; // 5% discount
    
    // ============ STRUCTS ============
    
    struct Card {
        string name;
        string cardId;
        uint256 vaultValue;      // Total value in vault
        uint256 totalShares;     // Total fractional shares
        uint256 availableShares; // Shares available for purchase
        uint256 buyoutValue;     // Premium buyout price (+25%)
        bool active;
    }
    
    struct UserOwnership {
        uint256 sharesOwned;
        uint256 lastPurchaseTime;
    }
    
    struct BuyoutProposal {
        uint256 cardId;
        uint256 offerValue;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        address paymentToken;
        mapping(address => bool) hasVoted;
    }
    
    // ============ MAPPINGS ============
    
    mapping(uint256 => Card) public cards;
    mapping(uint256 => mapping(address => UserOwnership)) public userOwnership;
    mapping(uint256 => BuyoutProposal) public buyoutProposals;
    
    // Break purchase tracking
    mapping(address => uint256[]) public userBreakPurchases;
    
    // ============ EVENTS ============
    
    event BreakPurchase(
        address indexed buyer,
        uint256 indexed breakId,
        uint256 quantity,
        uint256 totalPaid,
        uint256 packCostAmount,
        uint256 profitAmount
    );
    
    event RevenueDistributed(
        uint256 indexed breakId,
        uint256 treasuryAmount,
        uint256 operationsAmount,
        uint256 tokenLiquidityAmount,
        uint256 investmentAmount
    );
    
    event FractionsPurchased(
        address indexed buyer,
        uint256 indexed cardId,
        uint256 shares,
        uint256 cost
    );
    
    event BuyoutProposed(
        uint256 indexed cardId,
        uint256 offerValue,
        uint256 deadline
    );
    
    event BuyoutVoted(
        uint256 indexed cardId,
        address indexed voter,
        bool approved,
        uint256 votingPower
    );
    
    event BuyoutExecuted(
        uint256 indexed cardId,
        uint256 totalPayout,
        uint256 platformFee
    );
    
    event PayoutDistributed(
        uint256 indexed cardId,
        address indexed recipient,
        uint256 amount
    );
    
    // Pre-sale events
    event PreSaleCreated(
        uint256 indexed preSaleId,
        string name,
        string productType,
        uint256 packsAvailable,
        uint256 packPrice,
        uint256 targetInventoryCost,
        uint256 openDate
    );
    
    event PreSalePurchase(
        address indexed buyer,
        uint256 indexed preSaleId,
        uint256 quantity,
        uint256 totalPaid
    );
    
    event InventoryAcquired(
        uint256 indexed preSaleId,
        uint256 amountPaid,
        uint256 remainingFunds
    );
    
    event PreSaleLive(
        uint256 indexed preSaleId,
        uint256 breakId
    );
    
    event PreSaleCancelled(
        uint256 indexed preSaleId,
        string reason
    );
    
    event RefundClaimed(
        address indexed buyer,
        uint256 indexed preSaleId,
        uint256 amount
    );
    
    // Break type events
    event BreakTypeAdded(
        uint256 indexed breakId,
        string name,
        uint256 packCost,
        uint256 packPrice
    );
    
    event BreakTypeUpdated(
        uint256 indexed breakId,
        uint256 packCost,
        uint256 packPrice,
        bool active
    );
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        address _treasury,
        address _operations,
        address _tokenLiquidity,
        address _investment
    ) {
        require(_treasury != address(0), "Invalid treasury");
        require(_operations != address(0), "Invalid operations");
        require(_tokenLiquidity != address(0), "Invalid token liquidity");
        require(_investment != address(0), "Invalid investment");
        
        treasuryWallet = _treasury;
        operationsWallet = _operations;
        tokenLiquidityWallet = _tokenLiquidity;
        investmentWallet = _investment;
    }
    
    function addBreakType(
        string memory name,
        uint256 packCost,
        uint256 packPrice
    ) external onlyOwner {
        require(bytes(name).length > 0, "Name required");
        require(packCost > 0, "Pack cost must be > 0");
        require(packPrice > packCost, "Sale price must exceed cost");
        
        uint256 breakId = breakTypeCount;
        breakTypes[breakId] = BreakType({
            name: name,
            packCost: packCost,
            packPrice: packPrice,
            active: true
        });
        breakTypeCount++;
        
        emit BreakTypeAdded(breakId, name, packCost, packPrice);
    }
    
    function updateBreakType(
        uint256 breakId,
        uint256 packCost,
        uint256 packPrice,
        bool active
    ) external onlyOwner {
        require(breakId < breakTypeCount, "Invalid break ID");
        require(packCost > 0, "Pack cost must be > 0");
        require(packPrice > packCost, "Sale price must exceed cost");
        
        BreakType storage bt = breakTypes[breakId];
        bt.packCost = packCost;
        bt.packPrice = packPrice;
        bt.active = active;
        
        emit BreakTypeUpdated(breakId, packCost, packPrice, active);
    }
    
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
    
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }
    
    function setPackCost(uint256 _packCost) external onlyOwner {
        defaultPackCost = _packCost;
    }
    
    function updateRevenueWallets(
        address _treasury,
        address _operations,
        address _tokenLiquidity,
        address _investment
    ) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        require(_operations != address(0), "Invalid operations");
        require(_tokenLiquidity != address(0), "Invalid token liquidity");
        require(_investment != address(0), "Invalid investment");
        
        treasuryWallet = _treasury;
        operationsWallet = _operations;
        tokenLiquidityWallet = _tokenLiquidity;
        investmentWallet = _investment;
    }
    
    /**
     * @dev Set eVAULT token address
     */
    function setEVAULTToken(address _eVAULT) external onlyOwner {
        require(_eVAULT != address(0), "Invalid address");
        eVAULTToken = _eVAULT;
        supportedTokens[_eVAULT] = true;
    }
    
    /**
     * @dev Set eVAULT discount rate (basis points)
     * 500 = 5% discount, 1000 = 10% discount
     */
    function setEVAULTDiscount(uint256 discountBps) external onlyOwner {
        require(discountBps <= 2000, "Max 20% discount");
        eVAULTDiscountBps = discountBps;
    }
    
    function addCard(
        uint256 cardId,
        string memory name,
        string memory cardRef,
        uint256 vaultValue,
        uint256 totalShares,
        uint256 buyoutValue
    ) external onlyOwner {
        require(!cards[cardId].active, "Card already exists");
        cards[cardId] = Card({
            name: name,
            cardId: cardRef,
            vaultValue: vaultValue,
            totalShares: totalShares,
            availableShares: totalShares,
            buyoutValue: buyoutValue,
            active: true
        });
    }
    
    function updateCardAvailability(
        uint256 cardId,
        uint256 newAvailableShares
    ) external onlyOwner {
        require(cards[cardId].active, "Card not active");
        cards[cardId].availableShares = newAvailableShares;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Set the rewards pool address for staking rewards
     */
    function setRewardsPool(address _rewardsPool) external onlyOwner {
        require(_rewardsPool != address(0), "Invalid address");
        rewardsPool = _rewardsPool;
    }
    
    // ============ PRE-SALE FUNCTIONS ============
    
    /**
     * @dev Create a new pre-sale for upcoming product
     * @param name Name of the break/product
     * @param productType Product type (e.g., "Ascended Heroes")
     * @param packsAvailable Total packs available for pre-sale
     * @param packPrice Price per pack
     * @param targetInventoryCost Total amount needed to acquire inventory
     * @param paymentToken Token accepted for payment
     * @param openDate Expected date when break will go live
     */
    function createPreSale(
        string memory name,
        string memory productType,
        uint256 packsAvailable,
        uint256 packPrice,
        uint256 targetInventoryCost,
        address paymentToken,
        uint256 openDate
    ) external onlyOwner returns (uint256 preSaleId) {
        require(supportedTokens[paymentToken], "Token not supported");
        require(packsAvailable > 0, "Must have packs available");
        require(packPrice > 0, "Pack price must be > 0");
        require(targetInventoryCost > 0, "Inventory cost must be > 0");
        require(openDate > block.timestamp, "Open date must be future");
        require(openDate <= block.timestamp + MAX_PRE_SALE_DURATION, "Open date too far in future");
        
        preSaleCount++;
        preSaleId = preSaleCount;
        
        PreSale storage preSale = preSales[preSaleId];
        preSale.name = name;
        preSale.productType = productType;
        preSale.packsAvailable = packsAvailable;
        preSale.packPrice = packPrice;
        preSale.targetInventoryCost = targetInventoryCost;
        preSale.paymentToken = paymentToken;
        preSale.openDate = openDate;
        preSale.inventoryAcquired = false;
        preSale.isLive = false;
        preSale.cancelled = false;
        
        emit PreSaleCreated(
            preSaleId,
            name,
            productType,
            packsAvailable,
            packPrice,
            targetInventoryCost,
            openDate
        );
    }
    
    /**
     * @dev Purchase packs in a pre-sale
     * Funds go to inventory fund wallet to acquire product
     */
    function purchasePreSale(
        uint256 preSaleId,
        uint256 quantity
    ) external nonReentrant whenNotPaused {
        PreSale storage preSale = preSales[preSaleId];
        
        require(!preSale.cancelled, "Pre-sale cancelled");
        require(!preSale.isLive, "Pre-sale already live");
        require(block.timestamp < preSale.openDate, "Pre-sale ended");
        require(quantity > 0, "Quantity must be > 0");
        require(quantity <= preSale.packsAvailable - preSale.packsSold, "Not enough packs available");
        
        uint256 totalCost = quantity * preSale.packPrice;
        IERC20 token = IERC20(preSale.paymentToken);
        
        // Transfer payment from buyer directly to inventory fund wallet
        require(inventoryFundWallet != address(0), "Inventory wallet not set");
        token.safeTransferFrom(msg.sender, inventoryFundWallet, totalCost);
        
        // Update pre-sale tracking
        preSale.packsSold += quantity;
        preSale.fundsRaised += totalCost;
        preSale.userPurchases[msg.sender] += quantity;
        
        emit PreSalePurchase(msg.sender, preSaleId, quantity, totalCost);
    }
    
    /**
     * @dev Mark inventory as acquired and transfer funds to operations
     * Called when product has been purchased with pre-sale funds
     */
    function acquireInventory(
        uint256 preSaleId,
        uint256 amountPaid
    ) external onlyOwner nonReentrant {
        PreSale storage preSale = preSales[preSaleId];
        
        require(!preSale.cancelled, "Pre-sale cancelled");
        require(!preSale.inventoryAcquired, "Already acquired");
        require(amountPaid <= preSale.fundsRaised, "Amount exceeds funds raised");
        
        preSale.inventoryAcquired = true;
        
        IERC20 token = IERC20(preSale.paymentToken);
        
        // Transfer inventory acquisition cost from inventory fund wallet to operations
        require(inventoryFundWallet != address(0), "Inventory wallet not set");
        token.safeTransferFrom(inventoryFundWallet, operationsWallet, amountPaid);
        
        uint256 remaining = preSale.fundsRaised - amountPaid;
        
        emit InventoryAcquired(preSaleId, amountPaid, remaining);
    }
    
    /**
     * @dev Convert pre-sale to live break
     * Called when product has arrived and break is ready to open
     */
    function activatePreSale(
        uint256 preSaleId,
        uint256 breakId
    ) external onlyOwner {
        PreSale storage preSale = preSales[preSaleId];
        
        require(!preSale.cancelled, "Pre-sale cancelled");
        require(preSale.inventoryAcquired, "Inventory not acquired");
        require(!preSale.isLive, "Already live");
        
        preSale.isLive = true;
        
        // Distribute any remaining profit from pre-sale
        if (preSale.fundsRaised > 0) {
            IERC20 token = IERC20(preSale.paymentToken);
            uint256 totalPackCost = preSale.packsSold * defaultPackCost;
            uint256 profit = preSale.fundsRaised - totalPackCost;
            
            if (profit > 0) {
                // Distribute profit according to revenue split
                _distributeProfit(token, profit, breakId);
            }
        }
        
        emit PreSaleLive(preSaleId, breakId);
    }
    
    /**
     * @dev Cancel a pre-sale (if unable to acquire inventory)
 * Allows users to claim refunds
     */
    function cancelPreSale(
        uint256 preSaleId,
        string memory reason
    ) external onlyOwner {
        PreSale storage preSale = preSales[preSaleId];
        
        require(!preSale.isLive, "Already live - cannot cancel");
        require(!preSale.cancelled, "Already cancelled");
        
        preSale.cancelled = true;
        
        emit PreSaleCancelled(preSaleId, reason);
    }
    
    /**
     * @dev Claim refund for cancelled pre-sale
     */
    function claimPreSaleRefund(uint256 preSaleId) external nonReentrant {
        PreSale storage preSale = preSales[preSaleId];
        
        require(preSale.cancelled, "Pre-sale not cancelled");
        require(!preSale.hasClaimedRefund[msg.sender], "Already claimed");
        require(!preSale.inventoryAcquired, "Inventory already purchased - cannot refund");
        
        uint256 purchasedAmount = preSale.userPurchases[msg.sender];
        require(purchasedAmount > 0, "No purchase to refund");
        
        uint256 refundAmount = purchasedAmount * preSale.packPrice;
        preSale.hasClaimedRefund[msg.sender] = true;
        
        IERC20 token = IERC20(preSale.paymentToken);
        token.safeTransfer(msg.sender, refundAmount);
        
        emit RefundClaimed(msg.sender, preSaleId, refundAmount);
    }
    
    /**
     * @dev Set inventory fund wallet
     */
    function setInventoryFundWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Invalid address");
        inventoryFundWallet = _wallet;
    }
    
    /**
     * @dev Get pre-sale info
     */
    function getPreSale(uint256 preSaleId) external view returns (
        string memory name,
        string memory productType,
        uint256 packsAvailable,
        uint256 packsSold,
        uint256 packPrice,
        uint256 targetInventoryCost,
        uint256 fundsRaised,
        address paymentToken,
        uint256 openDate,
        bool inventoryAcquired,
        bool isLive,
        bool cancelled
    ) {
        PreSale storage p = preSales[preSaleId];
        return (
            p.name,
            p.productType,
            p.packsAvailable,
            p.packsSold,
            p.packPrice,
            p.targetInventoryCost,
            p.fundsRaised,
            p.paymentToken,
            p.openDate,
            p.inventoryAcquired,
            p.isLive,
            p.cancelled
        );
    }
    
    /**
     * @dev Get user's pre-sale purchase
     */
    function getUserPreSalePurchase(uint256 preSaleId, address user) external view returns (uint256) {
        return preSales[preSaleId].userPurchases[user];
    }
    
    // ============ eVAULT PAYMENT FUNCTIONS ============
    
    /**
     * @dev Purchase break packs using eVAULT (with discount)
     * eVAULT is burned when used for purchases
     * @param breakId Identifier for the break (references breakTypes)
     * @param quantity Number of packs
     */
    function purchaseBreakPacksWithEVAULT(
        uint256 breakId,
        uint256 quantity
    ) external nonReentrant whenNotPaused {
        require(eVAULTToken != address(0), "eVAULT not set");
        require(quantity > 0, "Quantity must be > 0");
        require(breakId < breakTypeCount, "Invalid break ID");
        
        BreakType storage bt = breakTypes[breakId];
        require(bt.active, "Break type not active");
        
        uint256 packPrice = bt.packPrice;
        uint256 packCost = bt.packCost;
        
        // Calculate total with eVAULT discount
        uint256 totalWithoutDiscount = quantity * packPrice;
        uint256 discountAmount = (totalWithoutDiscount * eVAULTDiscountBps) / BPS_DENOMINATOR;
        uint256 eVAULTAmount = totalWithoutDiscount - discountAmount;
        
        // Calculate cost/profit split in stablecoin terms
        uint256 totalPackCost = quantity * packCost;
        uint256 profit = totalWithoutDiscount - totalPackCost;
        
        // Transfer and burn eVAULT
        IERC20(eVAULTToken).safeTransferFrom(msg.sender, address(this), eVAULTAmount);
        IeVAULT(eVAULTToken).burn(address(this), eVAULTAmount);
        
        // Distribute the equivalent stablecoin amounts from treasury/operations
        // In practice, the protocol holds reserves to cover eVAULT redemptions
        // Pack cost goes to operations for restocking
        // Profit is distributed per revenue split
        
        // Note: In production, you'd have a reserve pool that converts burned eVAULT
        // to actual stablecoins for distribution. For now, we track the amounts.
        
        emit BreakPurchase(
            msg.sender,
            breakId,
            quantity,
            eVAULTAmount,
            totalPackCost,
            profit
        );
    }
    
    /**
     * @dev Purchase fractional shares using eVAULT (with discount)
     * eVAULT is burned when used for purchases
     */
    function purchaseFractionsWithEVAULT(
        uint256 cardId,
        uint256 shares
    ) external nonReentrant whenNotPaused {
        require(eVAULTToken != address(0), "eVAULT not set");
        require(cards[cardId].active, "Card not active");
        require(shares > 0, "Shares must be > 0");
        require(shares <= cards[cardId].availableShares, "Not enough shares");
        
        Card storage card = cards[cardId];
        uint256 sharePrice = card.vaultValue / card.totalShares;
        uint256 totalCostWithoutDiscount = shares * sharePrice;
        
        // Apply eVAULT discount
        uint256 discountAmount = (totalCostWithoutDiscount * eVAULTDiscountBps) / BPS_DENOMINATOR;
        uint256 eVAULTAmount = totalCostWithoutDiscount - discountAmount;
        
        // Transfer and burn eVAULT
        IERC20(eVAULTToken).safeTransferFrom(msg.sender, address(this), eVAULTAmount);
        IeVAULT(eVAULTToken).burn(address(this), eVAULTAmount);
        
        // Update ownership
        userOwnership[cardId][msg.sender].sharesOwned += shares;
        userOwnership[cardId][msg.sender].lastPurchaseTime = block.timestamp;
        card.availableShares -= shares;
        
        emit FractionsPurchased(msg.sender, cardId, shares, eVAULTAmount);
    }
    
    // ============ BREAK PAYMENT FUNCTIONS (STABLECOIN) ============
    
    /**
     * @dev Purchase break packs with automatic revenue distribution
     * @param paymentToken The token used for payment (USDC/USDT)
     * @param breakId Identifier for the break being purchased (references breakTypes)
     * @param quantity Number of packs to buy
     */
    function purchaseBreakPacks(
        address paymentToken,
        uint256 breakId,
        uint256 quantity
    ) external nonReentrant whenNotPaused {
        require(supportedTokens[paymentToken], "Token not supported");
        require(quantity > 0, "Quantity must be > 0");
        require(breakId < breakTypeCount, "Invalid break ID");
        
        BreakType storage bt = breakTypes[breakId];
        require(bt.active, "Break type not active");
        
        IERC20 token = IERC20(paymentToken);
        uint256 packPrice = bt.packPrice;
        uint256 packCost = bt.packCost;
        
        uint256 totalRevenue = quantity * packPrice;
        uint256 totalPackCost = quantity * packCost;
        uint256 profit = totalRevenue - totalPackCost;
        
        // Transfer total from buyer
        token.safeTransferFrom(msg.sender, address(this), totalRevenue);
        
        // Distribute pack cost to operations (for rebuying stock)
        token.safeTransfer(operationsWallet, totalPackCost);
        
        // Distribute profit according to revenue split
        _distributeProfit(token, profit, breakId);
        
        // Record purchase
        userBreakPurchases[msg.sender].push(breakId);
        
        emit BreakPurchase(
            msg.sender,
            breakId,
            quantity,
            totalRevenue,
            totalPackCost,
            profit
        );
    }
    
    /**
     * @dev Internal function to distribute profit
     */
    function _distributeProfit(
        IERC20 token,
        uint256 profit,
        uint256 breakId
    ) internal {
        uint256 treasuryAmount = (profit * TREASURY_SHARE) / 100;
        uint256 operationsAmount = (profit * OPERATIONS_SHARE) / 100;
        uint256 tokenLiquidityAmount = (profit * TOKEN_LIQUIDITY_SHARE) / 100;
        uint256 investmentAmount = profit - treasuryAmount - operationsAmount - tokenLiquidityAmount;
        
        token.safeTransfer(treasuryWallet, treasuryAmount);
        token.safeTransfer(operationsWallet, operationsAmount);
        token.safeTransfer(tokenLiquidityWallet, tokenLiquidityAmount);
        token.safeTransfer(investmentWallet, investmentAmount);
        
        emit RevenueDistributed(
            breakId,
            treasuryAmount,
            operationsAmount,
            tokenLiquidityAmount,
            investmentAmount
        );
    }
    
    // ============ FRACTIONAL OWNERSHIP FUNCTIONS ============
    
    /**
     * @dev Purchase fractional shares of a card
     */
    function purchaseFractions(
        address paymentToken,
        uint256 cardId,
        uint256 shares
    ) external nonReentrant whenNotPaused {
        require(supportedTokens[paymentToken], "Token not supported");
        require(cards[cardId].active, "Card not active");
        require(shares > 0, "Shares must be > 0");
        require(shares <= cards[cardId].availableShares, "Not enough shares available");
        
        Card storage card = cards[cardId];
        uint256 sharePrice = card.vaultValue / card.totalShares;
        uint256 totalCost = shares * sharePrice;
        
        IERC20 token = IERC20(paymentToken);
        token.safeTransferFrom(msg.sender, address(this), totalCost);
        
        // Update ownership
        userOwnership[cardId][msg.sender].sharesOwned += shares;
        userOwnership[cardId][msg.sender].lastPurchaseTime = block.timestamp;
        card.availableShares -= shares;
        
        // Transfer funds to operations wallet (for internal credit system)
        token.safeTransfer(operationsWallet, totalCost);
        
        emit FractionsPurchased(msg.sender, cardId, shares, totalCost);
    }
    
    /**
     * @dev Get user's ownership percentage for a card
     */
    function getUserOwnershipPercent(
        uint256 cardId,
        address user
    ) external view returns (uint256) {
        uint256 shares = userOwnership[cardId][user].sharesOwned;
        if (shares == 0) return 0;
        return (shares * 100) / cards[cardId].totalShares;
    }
    
    // ============ BUYOUT FUNCTIONS ============
    
    /**
     * @dev Propose a buyout for a card
     * Requires offering the buyout value (+25% premium)
     */
    function proposeBuyout(
        address paymentToken,
        uint256 cardId
    ) external nonReentrant whenNotPaused {
        require(supportedTokens[paymentToken], "Token not supported");
        require(cards[cardId].active, "Card not active");
        
        // Prevent overwriting active proposal
        BuyoutProposal storage existingProposal = buyoutProposals[cardId];
        require(
            existingProposal.deadline < block.timestamp || existingProposal.executed,
            "Active proposal exists"
        );
        
        Card storage card = cards[cardId];
        uint256 offerValue = card.buyoutValue;
        
        IERC20 token = IERC20(paymentToken);
        token.safeTransferFrom(msg.sender, address(this), offerValue);
        
        // Create proposal
        BuyoutProposal storage proposal = buyoutProposals[cardId];
        proposal.cardId = cardId;
        proposal.offerValue = offerValue;
        proposal.votesFor = 0;
        proposal.votesAgainst = 0;
        proposal.deadline = block.timestamp + 7 days;
        proposal.executed = false;
        proposal.paymentToken = paymentToken;
        
        emit BuyoutProposed(cardId, offerValue, proposal.deadline);
    }
    
    /**
     * @dev Vote on an active buyout proposal
     */
    function voteOnBuyout(
        uint256 cardId,
        bool approve
    ) external nonReentrant whenNotPaused {
        BuyoutProposal storage proposal = buyoutProposals[cardId];
        require(proposal.cardId == cardId, "No active proposal");
        require(block.timestamp < proposal.deadline, "Voting period ended");
        require(!proposal.executed, "Already executed");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        uint256 votingPower = userOwnership[cardId][msg.sender].sharesOwned;
        require(votingPower > 0, "No ownership");
        
        proposal.hasVoted[msg.sender] = true;
        
        if (approve) {
            proposal.votesFor += votingPower;
        } else {
            proposal.votesAgainst += votingPower;
        }
        
        emit BuyoutVoted(cardId, msg.sender, approve, votingPower);
        
        // Auto-execute if 51% reached
        uint256 totalVotingPower = proposal.votesFor + proposal.votesAgainst;
        if ((proposal.votesFor * 100) / cards[cardId].totalShares >= 51) {
            _executeBuyout(cardId);
        }
    }
    
    /**
     * @dev Internal function to execute buyout and distribute payouts
     */
    function _executeBuyout(uint256 cardId) internal {
        BuyoutProposal storage proposal = buyoutProposals[cardId];
        require(!proposal.executed, "Already executed");
        
        Card storage card = cards[cardId];
        uint256 totalBuyoutValue = proposal.offerValue;
        
        // Calculate total platform fee (2.5%)
        uint256 platformFee = (totalBuyoutValue * BUYOUT_FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributableAmount = totalBuyoutValue - platformFee;
        
        // Distribute platform fee
        _distributeBuyoutFee(platformFee);
        
        // Distribute payouts to all shareholders proportionally
        // Note: In production, you'd iterate through shareholders
        // For gas efficiency, use a pull pattern where users claim
        
        proposal.executed = true;
        card.active = false;
        
        emit BuyoutExecuted(cardId, distributableAmount, platformFee);
    }
    
    /**
     * @dev Distribute buyout platform fee
     */
    function _distributeBuyoutFee(uint256 feeAmount) internal {
        // This assumes the contract holds the fee in its balance
        // In practice, you'd track fees and distribute from contract holdings
        
        // Fee split mirrors revenue distribution
        uint256 treasuryAmount = (feeAmount * TREASURY_SHARE) / 100;
        uint256 operationsAmount = (feeAmount * OPERATIONS_SHARE) / 100;
        uint256 tokenLiquidityAmount = (feeAmount * TOKEN_LIQUIDITY_SHARE) / 100;
        uint256 investmentAmount = feeAmount - treasuryAmount - operationsAmount - tokenLiquidityAmount;
        
        // Note: In production, transfer actual tokens held by contract
        // This is a placeholder for the fee distribution logic
    }
    
    /**
     * @dev Claim buyout payout (pull pattern for gas efficiency)
     * Uses the payment token stored at proposal creation
     */
    function claimBuyoutPayout(uint256 cardId) external nonReentrant {
        require(buyoutProposals[cardId].executed, "Buyout not executed");
        
        uint256 userShares = userOwnership[cardId][msg.sender].sharesOwned;
        require(userShares > 0, "No shares to claim");
        
        uint256 totalShares = cards[cardId].totalShares;
        uint256 distributableAmount = buyoutProposals[cardId].offerValue - 
            ((buyoutProposals[cardId].offerValue * BUYOUT_FEE_BPS) / BPS_DENOMINATOR);
        
        uint256 userPayout = (distributableAmount * userShares) / totalShares;
        
        // Clear ownership to prevent double-claiming
        userOwnership[cardId][msg.sender].sharesOwned = 0;
        
        // Transfer payout using the token stored at proposal creation
        address paymentToken = buyoutProposals[cardId].paymentToken;
        IERC20(paymentToken).safeTransfer(msg.sender, userPayout);
        
        emit PayoutDistributed(cardId, msg.sender, userPayout);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getUserBreakPurchases(address user) external view returns (uint256[] memory) {
        return userBreakPurchases[user];
    }
    
    function getBuyoutProposal(uint256 cardId) external view returns (
        uint256 offerValue,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 deadline,
        bool executed,
        address paymentToken
    ) {
        BuyoutProposal storage p = buyoutProposals[cardId];
        return (p.offerValue, p.votesFor, p.votesAgainst, p.deadline, p.executed, p.paymentToken);
    }
    
    function calculateBuyoutPayout(
        uint256 cardId,
        address user
    ) external view returns (uint256) {
        if (!buyoutProposals[cardId].executed) return 0;
        
        uint256 userShares = userOwnership[cardId][user].sharesOwned;
        if (userShares == 0) return 0;
        
        uint256 offerValue = buyoutProposals[cardId].offerValue;
        uint256 platformFee = (offerValue * BUYOUT_FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributable = offerValue - platformFee;
        
        return (distributable * userShares) / cards[cardId].totalShares;
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
