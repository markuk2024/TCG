# Phase 1 Beta Pre-Sale Timeline

## Overview
This document outlines the Phase 1 Beta Pre-Sale timeline for TCG Vault Protocol, covering the pre-sale functionality for Ascended Heroes and 151 pack breaks.

## Phase 1 Beta Timeline

### Week 1 (Current Week)
- ✅ Multi-pack-type support implemented in smart contract
- ✅ Order tracking system with order numbers added
- ✅ Dashboard analytics with wallet last-5-digits display
- 🔄 Deploy contracts to BSC Testnet
- 🔄 Update UI with new contract addresses

### Week 2
- Pre-sale smart contract functionality testing
- Ascended Heroes pre-sale configuration
- 151 Pack Break pre-sale configuration
- Pre-sale UI development
- Integration testing

### Week 3
- Beta user onboarding (limited to 50 users)
- Pre-sale launch for Ascended Heroes
- Community feedback collection
- Bug fixes and optimizations

### Week 4
- 151 Pack Break pre-sale launch
- Full order tracking system live
- Dashboard analytics public release
- Marketing campaign for public beta

### Week 5-6
- Public beta launch
- All break types available for purchase
- Complete order history and analytics
- Mobile responsiveness improvements

## Key Features for Phase 1 Beta

### 1. Order Tracking System
- Unique order numbers for each purchase
- Last 5 digits of buyer's wallet address displayed (for privacy)
- Real-time order analytics on dashboard
- Order history with timestamps

### 2. Pre-Sale Functionality
- Early access to limited pack breaks
- Pre-sale pricing (discounted from regular price)
- Pre-sale time limits
- Refund functionality if break is cancelled

### 3. Pack Break Types (6 types configured)
- Booster Packs (Pokémon) - £12 sale / £8 cost
- Booster Boxes (Pokémon) - £100 sale / £75 cost
- Elite Trainer Boxes - £45 sale / £35 cost
- Special Collections - £60 sale / £45 cost
- Ascended Heroes Pre-Sale - £50 sale / £40 cost
- 151 Pack Break Pre-Sale - £55 sale / £42 cost

### 4. Dashboard Analytics
- Total orders count
- Today's orders
- Total revenue (in GBP)
- Recent orders list with buyer wallet (last 5 digits)

## Deployment Checklist

### Smart Contracts
- [x] Multi-pack-type support
- [x] Order tracking structs and mappings
- [x] View functions for analytics
- [ ] Deploy to BSC Testnet
- [ ] Verify contracts on BscScan
- [ ] Update contract addresses in UI

### Frontend
- [x] Order tracking display
- [x] Dashboard analytics cards
- [x] Wallet last-5-digits display
- [ ] Pre-sale UI components
- [ ] Pre-sale countdown timers
- [ ] Netlify deployment

### Testing
- [ ] End-to-end purchase flow
- [ ] Order creation and retrieval
- [ ] Analytics accuracy verification
- [ ] Pre-sale purchase flow
- [ ] Refund functionality

## Contact Information
For questions or support during the beta:
- GitHub: https://github.com/markuk2024/TCG
- Testnet Wallet: 0xFAE0598C7f1Ed0bBc49C366057Ca29497609dFd0

## Notes
- All prices shown in UI are sale prices (customer-facing)
- Pack costs are internal for inventory/rebuy calculations
- Pre-sales have limited spots and time windows
- Order numbers start from 0 and increment sequentially
