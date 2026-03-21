const hre = require("hardhat");

async function main() {
    // The MetaMask wallet address you're using to connect
    const recipientAddress = "0x740405cf31f75813385C72ddB925b3881D2574a6";
    
    console.log("Minting tokens to:", recipientAddress);
    
    // Your deployed Mock token addresses
    const MOCK_USDC = "0x0D78B96983D8483fa01A955FFB405873d0Db844b";
    const MOCK_USDT = "0x3433dA6272AC6740a8a8b9c010a2086EDf3fA75a";
    
    // Amount to mint (1,000,000 tokens with 18 decimals)
    const amount = hre.ethers.parseEther("1000000");
    
    // Get contract instances
    const mockUSDC = await hre.ethers.getContractAt("MockUSDC", MOCK_USDC);
    const mockUSDT = await hre.ethers.getContractAt("MockUSDT", MOCK_USDT);
    
    // Mint tokens
    console.log("\nMinting 1,000,000 Mock USDC...");
    const tx1 = await mockUSDC.mint(recipientAddress, amount);
    await tx1.wait();
    console.log("✅ Mock USDC minted!");
    
    console.log("\nMinting 1,000,000 Mock USDT...");
    const tx2 = await mockUSDT.mint(recipientAddress, amount);
    await tx2.wait();
    console.log("✅ Mock USDT minted!");
    
    // Check balances
    const usdcBalance = await mockUSDC.balanceOf(recipientAddress);
    const usdtBalance = await mockUSDT.balanceOf(recipientAddress);
    
    console.log("\n=== Balances for", recipientAddress, "===");
    console.log("Mock USDC:", hre.ethers.formatEther(usdcBalance));
    console.log("Mock USDT:", hre.ethers.formatEther(usdtBalance));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
