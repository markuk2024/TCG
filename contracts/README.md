# TCG Vault Protocol - Smart Contracts

Smart contracts for the TCG Vault Protocol fractional trading card marketplace on Binance Smart Chain (BSC).

## Overview

These contracts handle:
- **Break Payments** - Pack purchases with automatic revenue distribution
- **Fractional Ownership** - Internal credit-based share tracking
- **Buyout System** - Community voting on card buyouts with 2.5% platform fee

## Revenue Distribution

### Break Purchases
When users buy break packs:
1. **Pack Cost** (£10/pack) → Operations wallet (rebuy stock)
2. **Profit Split** (50% treasury, 20% operations, 20% token liquidity, 10% investment)

### Buyouts
When a card is bought out:
1. **Platform Fee** (2.5%) distributed:
   - 50% Treasury
   - 20% Operations
   - 20% Token Liquidity Vault
   - 10% Investment Vault
2. **Remaining** → Distributed to shareholders proportionally

## Smart Contracts

### TCGVaultProtocol.sol (Main Contract)
- Handles break payments with revenue distribution
- Manages fractional ownership tracking
- Implements buyout voting system
- Supports USDC/USDT on BSC

### MockTokens.sol (Testnet Only)
- Mock USDC and USDT for BSC testnet testing
- Includes minting functionality for test funds

## Deployment

### Prerequisites
```bash
npm install
```

Create `.env` file:
```
PRIVATE_KEY=your_wallet_private_key
BSCSCAN_API_KEY=your_bscscan_api_key
```

### Testnet Deployment
```bash
npm run deploy:testnet
```

### Mainnet Deployment
```bash
npm run deploy:mainnet
```

## Contract Addresses

### BSC Mainnet
- **TCGVaultProtocol**: `TBD` (deploy to get address)
- **USDC**: `0x8AC76a51cc950d9822D68b83fE1Ad97b32Cd580d`
- **USDT**: `0x55d398326f99059fF775485246999027B3197955`

### BSC Testnet
- Deploy mock tokens with the protocol for testing

## Key Functions

### For Users

**purchaseBreakPacks(token, breakId, quantity, packPrice)**
- Buy packs for a break
- Revenue auto-distributed

**purchaseFractions(token, cardId, shares)**
- Buy fractional shares of a card

**proposeBuyout(token, cardId)**
- Initiate buyout offer (+25% premium)

**voteOnBuyout(cardId, approve)**
- Vote on active buyout proposal

**claimBuyoutPayout(cardId, token)**
- Claim payout after successful buyout

### For Admins

**addCard(cardId, name, cardRef, vaultValue, totalShares, buyoutValue)**
- Add new fractionalized card

**addSupportedToken(token)**
- Add new payment token

**updateRevenueWallets(treasury, operations, tokenLiquidity, investment)**
- Update distribution addresses

## Frontend Integration

### Web3/ethers.js Example
```javascript
// Connect to contract
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const contract = new ethers.Contract(
  PROTOCOL_ADDRESS,
  TCGVaultProtocol_ABI,
  signer
);

// Purchase break packs
await contract.purchaseBreakPacks(
  USDC_ADDRESS,
  1, // breakId
  5, // quantity
  ethers.utils.parseEther("15") // packPrice
);

// Purchase fractions
await contract.purchaseFractions(
  USDC_ADDRESS,
  1, // cardId
  100 // shares
);
```

## Testing

```bash
# Compile contracts
npm run compile

# Run tests
npm run test
```

## Security

- Uses OpenZeppelin contracts (ReentrancyGuard, Ownable, Pausable)
- Non-reentrant functions for all payment operations
- Emergency withdraw function for stuck tokens
- Fee caps at contract level

## Architecture

```
User Purchase
    ↓
Smart Contract
    ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Treasury   │  │ Operations  │  │Token Liquidity│ │ Investment │
│    50%      │  │    20%      │  │    20%      │  │    10%     │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

## License

MIT License - see OpenZeppelin contracts for their respective licenses
