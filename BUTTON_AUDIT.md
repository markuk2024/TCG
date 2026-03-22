# Button and Contract Connection Audit

## ✅ WORKING - Breaks Page (breaks.html)

### Buttons Connected to Contracts:
1. **"Buy Pack Slot" buttons** (6 breaks)
   - Function: `openBreakPaymentModal(breakName, price, breakId)`
   - Contract: Uses `processCryptoPayment()` → Currently **NOT** calling smart contract
   - Status: ⚠️ **NEEDS FIX** - Payment flow doesn't call `purchaseBreakPacks()` contract function

2. **"Pay $X USDC/USDT" button**
   - Function: `processCryptoPayment()`
   - Contract: Should call `window.TCGWeb3.purchaseBreakPacks(breakId, quantity, paymentToken)`
   - Status: ⚠️ **NOT CONNECTED** - Only simulates payment, doesn't call contract

3. **"Add to Cart" buttons** (Pre-sale popup)
   - Function: `addToCart(breakName, price, 'presale')`
   - Contract: None (goes to checkout)
   - Status: ✅ Works for cart flow

4. **"Connect Wallet" button**
   - Function: `connectGlobalWallet()`
   - Contract: Calls `window.TCGWeb3.connectWallet()`
   - Status: ✅ **WORKING**

---

## ✅ WORKING - Dashboard Page (dashboard.html)

### Buttons Connected to Contracts:
1. **"Stake" button**
   - Function: `stakeVAULT()`
   - Contract: Calls `window.TCGWeb3.stakeTokens(amount, tier)`
   - Smart Contract: `contracts.staking.stake(tier, amountWei)`
   - Status: ✅ **WORKING**

2. **"Unstake" button**
   - Function: `unstakeVAULT()`
   - Contract: Should call `window.TCGWeb3.unstake(stakeIndex)`
   - Status: ⚠️ **PARTIAL** - Calls `unstakeTokens()` which doesn't exist in web3-integration.js

3. **"Claim Now" button**
   - Function: `window.TCGWeb3.claimRewards()`
   - Contract: Calls `contracts.staking.claimRewards()`
   - Status: ✅ **WORKING**

4. **"Claim All Rewards" link**
   - Function: `window.TCGWeb3.claimRewards()`
   - Contract: Calls `contracts.staking.claimRewards()`
   - Status: ✅ **WORKING**

---

## ⚠️ NEEDS REVIEW - Marketplace Page (marketplace.html)

### Expected Buttons (need to verify):
1. **"Buy Shares" buttons**
   - Should call: `window.TCGWeb3.purchaseShares(cardId, shares, paymentToken)`
   - Contract: `contracts.protocol.purchaseShares(paymentToken, cardId, shares)`
   - Status: ❓ **NEEDS VERIFICATION**

2. **"Propose Buyout" button**
   - Should call: `window.TCGWeb3.proposeBuyout(cardId, paymentToken)`
   - Contract: `contracts.protocol.proposeBuyout(paymentToken, cardId)`
   - Status: ❓ **NEEDS VERIFICATION**

---

## ⚠️ NEEDS REVIEW - Vault/Staking Page (vault.html)

### Expected Buttons:
1. **Staking buttons**
   - Should use same functions as dashboard
   - Status: ❓ **NEEDS VERIFICATION**

---

## 🔧 CRITICAL ISSUES FOUND

### 1. **Breaks Payment Not Connected to Contract**
**Location:** `script.js` - `processCryptoPayment()` function
**Issue:** The payment flow simulates success but doesn't call the smart contract
**Fix Needed:**
```javascript
// Current code just simulates payment
// NEEDS TO CALL:
await window.TCGWeb3.purchaseBreakPacks(
    currentBreakData.id,
    BSCState.packQuantity,
    BSCState.selectedToken
);
```

### 2. **Dashboard Unstake Function Mismatch**
**Location:** `dashboard.html` line 699
**Issue:** Calls `window.TCGWeb3.unstakeTokens(amount)` but web3-integration.js exports `unstake(stakeIndex)`
**Fix Needed:**
```javascript
// Change from:
await window.TCGWeb3.unstakeTokens(amount);
// To:
await window.TCGWeb3.unstake(stakeIndex);
```

### 3. **Missing Contract Functions**
The following functions are exported in `window.TCGWeb3` but may not be used anywhere:
- `getBreakTypes()`
- `getOrder(orderId)`
- `getRecentOrders(limit)`
- `getUserOrders()`
- `getTotalOrders()`
- `getPreSale(preSaleId)`
- `getActivePreSales()`
- `getUserPreSalePurchase(preSaleId)`
- `getUserShares(cardId)`

---

## 📋 AVAILABLE CONTRACT FUNCTIONS

### Staking Functions (✅ Working):
- `stakeTokens(tier, amount)` - ✅ Connected
- `unstake(stakeIndex)` - ⚠️ Wrong parameter in dashboard
- `emergencyUnstake(stakeIndex)` - ❓ Not used
- `claimRewards()` - ✅ Connected
- `getPendingRewards()` - ❓ Not used
- `getUserStakes()` - ❓ Not used

### Break Purchase Functions (⚠️ Not Connected):
- `purchaseBreakPacks(breakId, quantity, paymentToken)` - ❌ NOT CONNECTED
- `purchaseBreakPacksWithEVAULT(breakId, quantity)` - ❌ NOT CONNECTED

### Marketplace Functions (❓ Unknown):
- `purchaseShares(cardId, shares, paymentToken)` - ❓ Need to verify
- `purchaseSharesWithEVAULT(cardId, shares)` - ❓ Need to verify
- `proposeBuyout(cardId, paymentToken)` - ❓ Need to verify
- `voteOnBuyout(cardId, approve)` - ❓ Need to verify
- `claimBuyoutPayout(cardId)` - ❓ Need to verify

### Pre-Sale Functions (❓ Unknown):
- `purchasePreSale(preSaleId, quantity)` - ❓ Need to verify
- `claimPreSaleRefund(preSaleId)` - ❓ Need to verify

---

## 🎯 PRIORITY FIXES NEEDED

### HIGH PRIORITY:
1. **Connect breaks payment to smart contract** - Currently only simulates payment
2. **Fix dashboard unstake function call** - Wrong function name

### MEDIUM PRIORITY:
3. **Verify marketplace buttons** - Need to check if they exist and are connected
4. **Verify vault/staking page** - Need to check button connections

### LOW PRIORITY:
5. **Add emergency unstake button** - Function exists but no UI button
6. **Add pending rewards display** - Function exists but not used

---

## ✅ SUMMARY

**Working:**
- Wallet connection (all pages)
- Staking (dashboard)
- Claiming rewards (dashboard)
- Cart system (breaks → checkout)

**Broken/Not Connected:**
- Break purchases via crypto (not calling contract)
- Dashboard unstake (wrong function name)

**Unknown Status:**
- Marketplace share purchases
- Marketplace buyout features
- Pre-sale purchases
- Vault page staking

