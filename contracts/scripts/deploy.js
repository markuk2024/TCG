const hre = require("hardhat");

async function main() {
    console.log("Deploying TCG Vault Protocol to BSC...");
    
    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Deploy Mock Tokens (for testing - skip on mainnet)
    const isTestnet = hre.network.name === "bsctestnet";
    let usdcAddress, usdtAddress;
    
    // Define revenue wallet addresses
    // IMPORTANT: Replace these with your actual wallet addresses before deployment
    const TREASURY_WALLET = deployer.address; // Replace
    const OPERATIONS_WALLET = deployer.address; // Replace
    const TOKEN_LIQUIDITY_WALLET = deployer.address; // Replace
    const INVESTMENT_WALLET = deployer.address; // Replace
    
    if (isTestnet) {
        console.log("\nDeploying Mock Tokens...");
        
        const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();
        await mockUSDC.waitForDeployment();
        usdcAddress = await mockUSDC.getAddress();
        console.log("Mock USDC deployed to:", usdcAddress);
        
        const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
        const mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();
        usdtAddress = await mockUSDT.getAddress();
        console.log("Mock USDT deployed to:", usdtAddress);
    } else {
        // BSC Mainnet addresses (lowercase to avoid checksum errors on localhost)
        usdcAddress = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"; // BSC-USD
        usdtAddress = "0x55d398326f99059ff775485246999027b3197955"; // USDT
        console.log("Using Mainnet USDC/USDT:", usdcAddress, usdtAddress);
    }
    
    console.log("\n=== Deploying VAULT Token ===");
    const VAULTToken = await hre.ethers.getContractFactory("VAULTToken");
    const vaultToken = await VAULTToken.deploy();
    await vaultToken.waitForDeployment();
    const vaultTokenAddress = await vaultToken.getAddress();
    console.log("VAULT Token deployed to:", vaultTokenAddress);
    
    console.log("\n=== Deploying eVAULT Token ===");
    const eVAULTToken = await hre.ethers.getContractFactory("eVAULTToken");
    const eVAULT = await eVAULTToken.deploy();
    await eVAULT.waitForDeployment();
    const eVAULTAddress = await eVAULT.getAddress();
    console.log("eVAULT Token deployed to:", eVAULTAddress);
    
    // Deploy Protocol First (RewardsPool needs it)
    console.log("\n=== Deploying TCGVaultProtocol ===");
    const TCGVaultProtocol = await hre.ethers.getContractFactory("TCGVaultProtocol");
    const protocol = await TCGVaultProtocol.deploy(
        TREASURY_WALLET,
        OPERATIONS_WALLET,
        TOKEN_LIQUIDITY_WALLET,
        INVESTMENT_WALLET
    );
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();
    console.log("TCGVaultProtocol deployed to:", protocolAddress);
    
    console.log("\n=== Deploying RewardsPool ===");
    const RewardsPool = await hre.ethers.getContractFactory("RewardsPool");
    const rewardsPool = await RewardsPool.deploy(protocolAddress);
    await rewardsPool.waitForDeployment();
    const rewardsPoolAddress = await rewardsPool.getAddress();
    console.log("RewardsPool deployed to:", rewardsPoolAddress);
    
    console.log("\n=== Deploying VAULTStaking ===");
    const VAULTStaking = await hre.ethers.getContractFactory("VAULTStaking");
    const staking = await VAULTStaking.deploy(
        vaultTokenAddress,
        eVAULTAddress,
        rewardsPoolAddress
    );
    await staking.waitForDeployment();
    const stakingAddress = await staking.getAddress();
    console.log("VAULTStaking deployed to:", stakingAddress);
    
    // Configure contracts
    console.log("\n=== Configuring Contracts ===");
    
    // Add staking as authorized minter for eVAULT
    await (await eVAULT.authorizeMinter(stakingAddress)).wait();
    console.log("Staking contract authorized as eVAULT minter");
    
    // Add protocol as authorized spender for eVAULT
    await (await eVAULT.authorizeSpender(protocolAddress)).wait();
    console.log("Protocol authorized as eVAULT spender");
    
    // Set RewardsPool in protocol
    await (await protocol.setRewardsPool(rewardsPoolAddress)).wait();
    console.log("RewardsPool set in protocol");
    
    // Configure RewardsPool
    await (await rewardsPool.setStakingContract(stakingAddress)).wait();
    console.log("Staking contract set in RewardsPool");
    
    // Add supported tokens to RewardsPool
    await (await rewardsPool.addSupportedToken(usdcAddress, hre.ethers.parseUnits("1", 12))).wait(); // 10^12 to normalize 6 decimals to 18
    await (await rewardsPool.addSupportedToken(usdtAddress, hre.ethers.parseUnits("1", 12))).wait();
    console.log("USDC/USDT added to RewardsPool");
    
    // Set eVAULT in protocol
    await (await protocol.setEVAULTToken(eVAULTAddress)).wait();
    console.log("eVAULT token set in protocol");
    
    // Add supported tokens to protocol
    await (await protocol.addSupportedToken(usdcAddress)).wait();
    await (await protocol.addSupportedToken(usdtAddress)).wait();
    console.log("USDC/USDT added as supported tokens");
    
    // Add sample cards (for testing)
    if (isTestnet) {
        console.log("\n=== Adding Break Types (Pack Breaks) ===");
        
        // Pack types with cost and sale price (in wei, 18 decimals)
        // 1 GBP ≈ 1.25 USD for display purposes
        const breakTypes = [
            { name: "Ascended Heroes", costGBP: 10, priceGBP: 12.50 },
            { name: "Surging Sparks", costGBP: 7, priceGBP: 10 },
            { name: "151", costGBP: 20, priceGBP: 30 },
            { name: "Destined Rivals", costGBP: 13, priceGBP: 16 },
            { name: "Prismatic Evolutions", costGBP: 12, priceGBP: 15 },
            { name: "Journey Together", costGBP: 6, priceGBP: 10 }
        ];
        
        for (const bt of breakTypes) {
            const packCost = hre.ethers.parseEther(bt.costGBP.toString());
            const packPrice = hre.ethers.parseEther(bt.priceGBP.toString());
            await (await protocol.addBreakType(bt.name, packCost, packPrice)).wait();
            console.log(`Break type added: ${bt.name} - Cost: £${bt.costGBP}, Sale: £${bt.priceGBP}`);
        }
        
        console.log("\nAdding sample cards...");
        
        // Charizard example
        await (await protocol.addCard(
            1, // cardId
            "PSA 10 Charizard VMAX", // name
            "charizard", // cardRef
            hre.ethers.parseEther("3500"), // vaultValue (£3500)
            3500, // totalShares
            hre.ethers.parseEther("4375") // buyoutValue (+25%)
        )).wait();
        
        // Umbreon example
        await (await protocol.addCard(
            2,
            "PSA 10 Umbreon VMAX",
            "umbreon",
            hre.ethers.parseEther("2000"),
            2000,
            hre.ethers.parseEther("2500")
        )).wait();
        
        // Black Lotus example
        await (await protocol.addCard(
            3,
            "Black Lotus PSA 7",
            "lotus",
            hre.ethers.parseEther("15000"),
            10000,
            hre.ethers.parseEther("18750")
        )).wait();
        
        console.log("Sample cards added");
        
        // Mint test tokens to deployer
        console.log("\nMinting test tokens...");
        await (await mockUSDC.mint(deployer.address, hre.ethers.parseEther("10000"))).wait();
        await (await vaultToken.mint(deployer.address, hre.ethers.parseEther("100000"))).wait();
        console.log("Minted 10,000 USDC and 100,000 VAULT to deployer");
    }
    
    console.log("\n=== Deployment Summary ===");
    console.log("Network:", hre.network.name);
    console.log("VAULT Token:", vaultTokenAddress);
    console.log("eVAULT Token:", eVAULTAddress);
    console.log("RewardsPool:", rewardsPoolAddress);
    console.log("VAULTStaking:", stakingAddress);
    console.log("TCGVaultProtocol:", protocolAddress);
    console.log("USDC/USDT:", usdcAddress);
    console.log("Treasury:", TREASURY_WALLET);
    console.log("Operations:", OPERATIONS_WALLET);
    console.log("Token Liquidity:", TOKEN_LIQUIDITY_WALLET);
    console.log("Investment:", INVESTMENT_WALLET);
    
    // Verification instructions
    console.log("\n=== Verification ===");
    console.log("To verify on BscScan:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${vaultTokenAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${eVAULTAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${rewardsPoolAddress} ${protocolAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${stakingAddress} ${vaultTokenAddress} ${eVAULTAddress} ${rewardsPoolAddress}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${protocolAddress} ${TREASURY_WALLET} ${OPERATIONS_WALLET} ${TOKEN_LIQUIDITY_WALLET} ${INVESTMENT_WALLET}`);
    
    // Save addresses to file
    const fs = require('fs');
    const addresses = {
        network: hre.network.name,
        vaultToken: vaultTokenAddress,
        eVAULT: eVAULTAddress,
        rewardsPool: rewardsPoolAddress,
        staking: stakingAddress,
        protocol: protocolAddress,
        usdc: usdcAddress,
        usdt: usdtAddress,
        treasury: TREASURY_WALLET,
        operations: OPERATIONS_WALLET,
        tokenLiquidity: TOKEN_LIQUIDITY_WALLET,
        investment: INVESTMENT_WALLET
    };
    fs.writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
    console.log("\nAddresses saved to deployed-addresses.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
