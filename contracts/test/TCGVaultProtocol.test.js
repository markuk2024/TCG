const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TCGVaultProtocol", function () {
    let protocol;
    let mockUSDC;
    let mockUSDT;
    let owner;
    let treasury;
    let operations;
    let tokenLiquidity;
    let investment;
    let buyer1;
    let buyer2;
    
    beforeEach(async function () {
        [owner, treasury, operations, tokenLiquidity, investment, buyer1, buyer2] = await ethers.getSigners();
        
        // Deploy mock tokens
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();
        await mockUSDC.deployed();
        
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        mockUSDT = await MockUSDT.deploy();
        await mockUSDT.deployed();
        
        // Deploy protocol
        const TCGVaultProtocol = await ethers.getContractFactory("TCGVaultProtocol");
        protocol = await TCGVaultProtocol.deploy(
            treasury.address,
            operations.address,
            tokenLiquidity.address,
            investment.address
        );
        await protocol.deployed();
        
        // Add supported tokens
        await protocol.addSupportedToken(mockUSDC.address);
        await protocol.addSupportedToken(mockUSDT.address);
        
        // Mint tokens to buyers
        await mockUSDC.mint(buyer1.address, ethers.utils.parseEther("10000"));
        await mockUSDC.mint(buyer2.address, ethers.utils.parseEther("10000"));
        
        // Approve protocol to spend tokens
        await mockUSDC.connect(buyer1).approve(protocol.address, ethers.utils.parseEther("10000"));
        await mockUSDC.connect(buyer2).approve(protocol.address, ethers.utils.parseEther("10000"));
        
        // Add a card
        await protocol.addCard(
            1,
            "PSA 10 Charizard VMAX",
            "charizard",
            ethers.utils.parseEther("3500"),
            3500,
            ethers.utils.parseEther("4375")
        );
    });
    
    describe("Break Purchases", function () {
        it("Should process break purchase with correct revenue distribution", async function () {
            const quantity = 5;
            const packPrice = ethers.utils.parseEther("15"); // £15 per pack
            const packCost = ethers.utils.parseEther("10"); // £10 cost
            
            const buyerBalanceBefore = await mockUSDC.balanceOf(buyer1.address);
            const opsBalanceBefore = await mockUSDC.balanceOf(operations.address);
            const treasuryBalanceBefore = await mockUSDC.balanceOf(treasury.address);
            
            await protocol.connect(buyer1).purchaseBreakPacks(
                mockUSDC.address,
                1, // breakId
                quantity,
                packPrice
            );
            
            const totalRevenue = packPrice.mul(quantity);
            const totalPackCost = packCost.mul(quantity);
            const profit = totalRevenue.sub(totalPackCost);
            
            // Check operations received pack cost
            const opsBalanceAfter = await mockUSDC.balanceOf(operations.address);
            expect(opsBalanceAfter.sub(opsBalanceBefore)).to.equal(totalPackCost);
            
            // Check treasury received 50% of profit
            const treasuryBalanceAfter = await mockUSDC.balanceOf(treasury.address);
            const expectedTreasury = profit.mul(50).div(100);
            expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(expectedTreasury);
            
            // Check buyer paid correct amount
            const buyerBalanceAfter = await mockUSDC.balanceOf(buyer1.address);
            expect(buyerBalanceBefore.sub(buyerBalanceAfter)).to.equal(totalRevenue);
        });
        
        it("Should emit correct events on break purchase", async function () {
            await expect(
                protocol.connect(buyer1).purchaseBreakPacks(
                    mockUSDC.address,
                    1,
                    2,
                    ethers.utils.parseEther("15")
                )
            )
                .to.emit(protocol, "BreakPurchase")
                .to.emit(protocol, "RevenueDistributed");
        });
    });
    
    describe("Fractional Ownership", function () {
        beforeEach(async function () {
            // Mint and approve for card purchases
            await mockUSDC.mint(buyer1.address, ethers.utils.parseEther("5000"));
            await mockUSDC.connect(buyer1).approve(protocol.address, ethers.utils.parseEther("5000"));
        });
        
        it("Should allow purchasing fractions", async function () {
            const shares = 100;
            const sharePrice = ethers.utils.parseEther("1"); // £3500 / 3500 shares
            const totalCost = sharePrice.mul(shares);
            
            await protocol.connect(buyer1).purchaseFractions(
                mockUSDC.address,
                1,
                shares
            );
            
            const ownership = await protocol.userOwnership(1, buyer1.address);
            expect(ownership.sharesOwned).to.equal(shares);
        });
        
        it("Should calculate ownership percentage correctly", async function () {
            await protocol.connect(buyer1).purchaseFractions(
                mockUSDC.address,
                1,
                350 // 10% of 3500 shares
            );
            
            const percent = await protocol.getUserOwnershipPercent(1, buyer1.address);
            expect(percent).to.equal(10);
        });
    });
    
    describe("Buyout System", function () {
        beforeEach(async function () {
            // Setup: Buyer1 and Buyer2 purchase fractions
            await mockUSDC.mint(buyer1.address, ethers.utils.parseEther("5000"));
            await mockUSDC.mint(buyer2.address, ethers.utils.parseEther("5000"));
            await mockUSDC.connect(buyer1).approve(protocol.address, ethers.utils.parseEther("5000"));
            await mockUSDC.connect(buyer2).approve(protocol.address, ethers.utils.parseEther("5000"));
            
            await protocol.connect(buyer1).purchaseFractions(mockUSDC.address, 1, 350); // 10%
            await protocol.connect(buyer2).purchaseFractions(mockUSDC.address, 1, 1750); // 50%
        });
        
        it("Should allow proposing a buyout", async function () {
            const buyoutValue = ethers.utils.parseEther("4375");
            await mockUSDC.mint(buyer1.address, buyoutValue);
            await mockUSDC.connect(buyer1).approve(protocol.address, buyoutValue);
            
            await expect(
                protocol.connect(buyer1).proposeBuyout(mockUSDC.address, 1)
            )
                .to.emit(protocol, "BuyoutProposed");
        });
        
        it("Should auto-execute buyout when 51% approval reached", async function () {
            const buyoutValue = ethers.utils.parseEther("4375");
            await mockUSDC.mint(buyer1.address, buyoutValue);
            await mockUSDC.connect(buyer1).approve(protocol.address, buyoutValue);
            
            // Propose buyout
            await protocol.connect(buyer1).proposeBuyout(mockUSDC.address, 1);
            
            // Buyer2 (50% ownership) approves - total 60%
            await protocol.connect(buyer2).voteOnBuyout(1, true);
            
            // Check if buyout executed
            const proposal = await protocol.getBuyoutProposal(1);
            expect(proposal.executed).to.equal(true);
        });
        
        it("Should calculate correct payout with 2.5% fee", async function () {
            const buyoutValue = ethers.utils.parseEther("4375");
            await mockUSDC.mint(buyer1.address, buyoutValue);
            await mockUSDC.connect(buyer1).approve(protocol.address, buyoutValue);
            
            await protocol.connect(buyer1).proposeBuyout(mockUSDC.address, 1);
            await protocol.connect(buyer2).voteOnBuyout(1, true);
            
            // Calculate expected payout for buyer1 (10% ownership)
            const expectedPayout = await protocol.calculateBuyoutPayout(1, buyer1.address);
            
            // 10% of (£4375 - 2.5% fee)
            const fee = buyoutValue.mul(250).div(10000);
            const distributable = buyoutValue.sub(fee);
            const expected = distributable.mul(350).div(3500); // 10%
            
            expect(expectedPayout).to.equal(expected);
        });
    });
    
    describe("Admin Functions", function () {
        it("Should allow owner to add/remove supported tokens", async function () {
            const newToken = mockUSDT.address;
            
            await protocol.addSupportedToken(newToken);
            expect(await protocol.supportedTokens(newToken)).to.equal(true);
            
            await protocol.removeSupportedToken(newToken);
            expect(await protocol.supportedTokens(newToken)).to.equal(false);
        });
        
        it("Should allow owner to update revenue wallets", async function () {
            await protocol.updateRevenueWallets(
                buyer1.address,
                buyer2.address,
                treasury.address,
                operations.address
            );
            
            expect(await protocol.treasuryWallet()).to.equal(buyer1.address);
        });
    });
});
