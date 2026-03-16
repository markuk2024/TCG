# Manual Deployment Instructions

## For Localhost Testing (When You Have Other Bots Running)

Since you have other bots running on your system, here are manual steps to deploy without interference:

### Option 1: Deploy to Localhost (When Hardhat Node is Already Running)

1. Open a NEW terminal (don't use any terminal with bots running)
2. Navigate to contracts folder:
   ```
   cd "c:\Users\mb202\OneDrive\Desktop\lee project\contracts"
   ```
3. Check if hardhat node is running on port 8545:
   ```
   curl http://127.0.0.1:8545 -Method POST -Body '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' -ContentType 'application/json'
   ```
4. If node is running, deploy:
   ```
   npx hardhat run deploy.js --network localhost
   ```

### Option 2: Deploy to BSC Testnet (Using Your Wallet)

Your wallet with testnet BNB: `0xFAE0598C7f1Ed0bBc49C366057Ca29497609dFd0`

1. Make sure `.env` file in contracts folder has your PRIVATE_KEY
2. Run:
   ```
   cd "c:\Users\mb202\OneDrive\Desktop\lee project\contracts"
   npx hardhat run deploy.js --network bsctestnet
   ```

### Option 3: Quick Deploy Script (PowerShell)

Save this as `quick-deploy.ps1` and run in fresh PowerShell:

```powershell
Set-Location "c:\Users\mb202\OneDrive\Desktop\lee project\contracts"
npx hardhat compile
npx hardhat run deploy.js --network localhost
Copy-Item "deployed-addresses.json" "..\deployed-addresses.json" -Force
Write-Host "Deployment complete! Check deployed-addresses.json for new addresses."
```

## After Deployment

The deploy script automatically:
1. Deploys all contracts
2. Adds 6 pack break types (Booster Packs, Booster Boxes, etc.)
3. Saves addresses to `deployed-addresses.json`
4. Copies addresses to parent folder for UI

## Current Contract Addresses (From Last Deploy)

If you can't deploy right now, these localhost addresses should still work:
- **protocol**: `0xe8D2A1E88c91DCd5433208d4152Cc4F399a7e91d`
- **eVAULT**: `0x720472c8ce72c2A2D711333e064ABD3E6BbEAdd3`
- **vaultToken**: `0x5c74c94173F05dA1720953407cbb920F3DF9f887`
- **usdc**: `0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d`
- **usdt**: `0x55d398326f99059ff775485246999027b3197955`

## Pre-Sale Configuration (Next Steps)

After deploying, configure pre-sales:
1. Ascended Heroes pre-sale: 50 packs, £50 price, 7-day window
2. 151 Pack Break pre-sale: 100 packs, £55 price, 7-day window

Use the admin functions in the contract or the upcoming pre-sale UI.
