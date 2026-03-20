const hre = require("hardhat");

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("Minting tokens to:", signer.address);
    
    // Your deployed Mock token addresses
    const MOCK_USDC = "0x0D78B96983D8483fa01A955FFB405873d0Db844b";
    const MOCK_USDT = "0x3433dA6272AC6740a8a8b9c010a2086EDf3fA75a";
    
    // Amount to mint (10,000 tokens with 18 decimals)
    const amount = hre.ethers.parseEther("10000");
    
    // Get contract instances
    const mockUSDC = await hre.ethers.getContractAt("MockUSDC", MOCK_USDC);
    const mockUSDT = await hre.ethers.getContractAt("MockUSDT", MOCK_USDT);
    
    // Mint tokens
    console.log("\nMinting 10,000 Mock USDC...");
    const tx1 = await mockUSDC.mint(signer.address, amount);
    await tx1.wait();
    console.log("✅ Mock USDC minted!");
    
    console.log("\nMinting 10,000 Mock USDT...");
    const tx2 = await mockUSDT.mint(signer.address, amount);
    await tx2.wait();
    console.log("✅ Mock USDT minted!");
    
    // Check balances
    const usdcBalance = await mockUSDC.balanceOf(signer.address);
    const usdtBalance = await mockUSDT.balanceOf(signer.address);
    
    console.log("\n=== Your Balances ===");
    console.log("Mock USDC:", hre.ethers.formatEther(usdcBalance));
    console.log("Mock USDT:", hre.ethers.formatEther(usdtBalance));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
