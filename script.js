// Count up animation for stats
function animateValue(element, start, end, duration, prefix = '') {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = prefix + value.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const target = entry.target;
            const count = parseInt(target.getAttribute('data-count'));
            const isCurrency = target.classList.contains('treasury-amount') || target.closest('.stat');
            
            if (count) {
                animateValue(target, 0, count, 2000, isCurrency ? '$' : '');
            }
            
            observer.unobserve(target);
        }
    });
}, observerOptions);

// Observe all stat elements
document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));

// Countdown timers
function updateTimers() {
    document.querySelectorAll('.timer-value').forEach(timer => {
        let time = parseInt(timer.getAttribute('data-time'));
        if (time > 0) {
            time--;
            timer.setAttribute('data-time', time);
            
            const hours = Math.floor(time / 3600);
            const minutes = Math.floor((time % 3600) / 60);
            const seconds = time % 60;
            
            timer.textContent = 
                String(hours).padStart(2, '0') + ':' +
                String(minutes).padStart(2, '0') + ':' +
                String(seconds).padStart(2, '0');
        }
    });
}

setInterval(updateTimers, 1000);

// Navbar background on scroll
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.style.background = 'rgba(10, 10, 15, 0.98)';
    } else {
        nav.style.background = 'rgba(10, 10, 15, 0.95)';
    }
});

// Wallet State Management
const WalletState = {
    connected: false,
    address: null,
    balance: 5250.00,
    chainId: null,
    provider: null
};

// Check if wallet is already connected on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedWallet = localStorage.getItem('walletConnected');
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedWallet === 'true' && savedAddress) {
        WalletState.connected = true;
        WalletState.address = savedAddress;
        updateWalletUI();
    }
    
    // Add wallet button to nav if not present
    addWalletButtonToNav();
});

function addWalletButtonToNav() {
    const navContainer = document.querySelector('.nav-container');
    if (!navContainer || document.querySelector('.wallet-btn')) return;
    
    const walletBtn = document.createElement('button');
    walletBtn.className = 'wallet-btn';
    walletBtn.onclick = () => showWalletModal();
    
    navContainer.insertBefore(walletBtn, navContainer.querySelector('.mobile-menu-btn'));
    updateWalletUI();
}

function updateWalletUI() {
    const walletBtn = document.querySelector('.wallet-btn');
    if (!walletBtn) return;
    
    if (WalletState.connected && WalletState.address) {
        const shortAddress = `${WalletState.address.slice(0, 6)}...${WalletState.address.slice(-4)}`;
        walletBtn.innerHTML = `
            <span class="wallet-indicator"></span>
            <span class="wallet-address">${shortAddress}</span>
        `;
        walletBtn.classList.add('connected');
    } else {
        walletBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="6" width="20" height="12" rx="2"/>
                <circle cx="12" cy="12" r="2"/>
                <path d="M6 12h.01"/>
            </svg>
            <span>Connect Wallet</span>
        `;
        walletBtn.classList.remove('connected');
    }
}

function showWalletModal() {
    if (WalletState.connected) {
        showWalletDetails();
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'wallet-modal';
    modal.id = 'walletModal';
    modal.innerHTML = `
        <div class="wallet-modal-overlay" onclick="closeWalletModal()"></div>
        <div class="wallet-modal-content">
            <div class="wallet-modal-header">
                <h3>Connect Wallet</h3>
                <button class="close-btn" onclick="closeWalletModal()">&times;</button>
            </div>
            <div class="wallet-options">
                <div class="wallet-option" onclick="connectMetaMask()">
                    <div class="wallet-icon">🦊</div>
                    <div class="wallet-info">
                        <div class="wallet-name">MetaMask</div>
                        <div class="wallet-desc">Most popular wallet</div>
                    </div>
                </div>
                <div class="wallet-option" onclick="connectWalletConnect()">
                    <div class="wallet-icon">🔗</div>
                    <div class="wallet-info">
                        <div class="wallet-name">WalletConnect</div>
                        <div class="wallet-desc">Connect any wallet</div>
                    </div>
                </div>
                <div class="wallet-option" onclick="connectPhantom()">
                    <div class="wallet-icon">👻</div>
                    <div class="wallet-info">
                        <div class="wallet-name">Phantom</div>
                        <div class="wallet-desc">Solana & EVM support</div>
                    </div>
                </div>
                <div class="wallet-option" onclick="connectCoinbase()">
                    <div class="wallet-icon">🔵</div>
                    <div class="wallet-info">
                        <div class="wallet-name">Coinbase Wallet</div>
                        <div class="wallet-desc">Easy for beginners</div>
                    </div>
                </div>
            </div>
            <div class="wallet-note">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                By connecting, you agree to our Terms of Service
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeWalletModal() {
    const modal = document.getElementById('walletModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

function showWalletDetails() {
    const modal = document.createElement('div');
    modal.className = 'wallet-modal';
    modal.id = 'walletModal';
    modal.innerHTML = `
        <div class="wallet-modal-overlay" onclick="closeWalletModal()"></div>
        <div class="wallet-modal-content">
            <div class="wallet-modal-header">
                <h3>My Wallet</h3>
                <button class="close-btn" onclick="closeWalletModal()">&times;</button>
            </div>
            <div class="wallet-details">
                <div class="wallet-address-full">${WalletState.address}</div>
                <div class="wallet-balance-row">
                    <span class="balance-label">VAULT Balance</span>
                    <span class="balance-value">${WalletState.balance.toLocaleString()} VAULT</span>
                </div>
                <div class="wallet-balance-row">
                    <span class="balance-label">Estimated Value</span>
                    <span class="balance-value">£${(WalletState.balance * 0.25).toFixed(2)}</span>
                </div>
                <div class="wallet-actions">
                    <button class="btn-secondary" onclick="copyAddress()">Copy Address</button>
                    <button class="btn-danger" onclick="disconnectWallet()">Disconnect</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

// Wallet Connection Functions
async function connectMetaMask() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!');
        window.open('https://metamask.io', '_blank');
        return;
    }
    
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
            WalletState.connected = true;
            WalletState.address = accounts[0];
            WalletState.provider = 'metamask';
            
            localStorage.setItem('walletConnected', 'true');
            localStorage.setItem('walletAddress', accounts[0]);
            
            closeWalletModal();
            updateWalletUI();
            
            // Listen for account changes
            window.ethereum.on('accountsChanged', (newAccounts) => {
                if (newAccounts.length === 0) {
                    disconnectWallet();
                } else {
                    WalletState.address = newAccounts[0];
                    localStorage.setItem('walletAddress', newAccounts[0]);
                    updateWalletUI();
                }
            });
            
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
        }
    } catch (error) {
        console.error('MetaMask connection failed:', error);
        alert('Connection failed: ' + error.message);
    }
}

function connectWalletConnect() {
    alert('WalletConnect integration requires the official SDK. This is a demo implementation.');
}

function connectPhantom() {
    if (window.solana && window.solana.isPhantom) {
        window.solana.connect()
            .then(({ publicKey }) => {
                WalletState.connected = true;
                WalletState.address = publicKey.toString();
                WalletState.provider = 'phantom';
                
                localStorage.setItem('walletConnected', 'true');
                localStorage.setItem('walletAddress', publicKey.toString());
                
                closeWalletModal();
                updateWalletUI();
            })
            .catch((err) => {
                console.error('Phantom connection failed:', err);
            });
    } else {
        alert('Please install Phantom wallet!');
        window.open('https://phantom.app', '_blank');
    }
}

function connectCoinbase() {
    alert('Coinbase Wallet integration requires the official SDK. This is a demo implementation.');
}

function disconnectWallet() {
    WalletState.connected = false;
    WalletState.address = null;
    WalletState.provider = null;
    
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
    
    closeWalletModal();
    updateWalletUI();
}

function copyAddress() {
    navigator.clipboard.writeText(WalletState.address);
    alert('Address copied to clipboard!');
}

function getWalletState() {
    return WalletState;
}

// Make functions globally available
window.WalletState = WalletState;
window.showWalletModal = showWalletModal;
window.closeWalletModal = closeWalletModal;
window.connectMetaMask = connectMetaMask;
window.connectWalletConnect = connectWalletConnect;
window.connectPhantom = connectPhantom;
window.connectCoinbase = connectCoinbase;
window.disconnectWallet = disconnectWallet;
window.copyAddress = copyAddress;
window.getWalletState = getWalletState;

// Shopping Cart State
const CartState = {
    items: [],
    total: 0
};

// Load cart from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        CartState.items = JSON.parse(savedCart);
        updateCartCount();
    }
    
    // Add cart button to nav
    addCartButtonToNav();
});

function addCartButtonToNav() {
    const navContainer = document.querySelector('.nav-container');
    if (!navContainer || document.querySelector('.cart-btn')) return;
    
    const cartBtn = document.createElement('button');
    cartBtn.className = 'cart-btn';
    cartBtn.onclick = () => showCartModal();
    cartBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <span class="cart-count">0</span>
    `;
    
    navContainer.insertBefore(cartBtn, navContainer.querySelector('.mobile-menu-btn'));
    updateCartCount();
}

function updateCartCount() {
    const cartBtn = document.querySelector('.cart-btn');
    if (!cartBtn) return;
    
    const count = CartState.items.reduce((sum, item) => sum + item.quantity, 0);
    const countBadge = cartBtn.querySelector('.cart-count');
    countBadge.textContent = count;
    countBadge.style.display = count > 0 ? 'flex' : 'none';
}

function showQuantityModal(id, name, price, icon) {
    const modal = document.createElement('div');
    modal.className = 'cart-modal quantity-modal';
    modal.id = 'quantityModal';
    modal.innerHTML = `
        <div class="cart-modal-overlay" onclick="closeQuantityModal()"></div>
        <div class="cart-modal-content">
            <div class="cart-modal-header">
                <h3>Select Quantity</h3>
                <button class="close-btn" onclick="closeQuantityModal()">&times;</button>
            </div>
            <div class="quantity-content">
                <div class="quantity-item">
                    <div class="quantity-icon">${icon}</div>
                    <div class="quantity-info">
                        <div class="quantity-name">${name}</div>
                        <div class="quantity-price">$${price} per share</div>
                    </div>
                </div>
                <div class="quantity-selector">
                    <button class="qty-btn" onclick="adjustQuantity(-1)">-</button>
                    <input type="number" id="qtyInput" value="1" min="1" max="100" readonly>
                    <button class="qty-btn" onclick="adjustQuantity(1)">+</button>
                </div>
                <div class="quantity-total">
                    Total: $<span id="qtyTotal">${price}</span>
                </div>
                <button class="btn-primary btn-full" onclick="addToCartFromModal('${id}', '${name}', ${price}, '${icon}')">
                    Add to Cart
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Store current item data
    window.currentQtyItem = { id, name, price, icon };
}

function closeQuantityModal() {
    const modal = document.getElementById('quantityModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

function adjustQuantity(change) {
    const input = document.getElementById('qtyInput');
    let newVal = parseInt(input.value) + change;
    if (newVal < 1) newVal = 1;
    if (newVal > 100) newVal = 100;
    input.value = newVal;
    
    // Update total
    const total = (newVal * window.currentQtyItem.price).toFixed(2);
    document.getElementById('qtyTotal').textContent = total;
}

function addToCartFromModal(id, name, price, icon) {
    const qty = parseInt(document.getElementById('qtyInput').value);
    
    const existingItem = CartState.items.find(item => item.id === id);
    if (existingItem) {
        existingItem.quantity += qty;
    } else {
        CartState.items.push({ id, name, price, icon, quantity: qty });
    }
    
    saveCart();
    updateCartCount();
    closeQuantityModal();
    
    // Show mini notification
    showCartNotification(`${qty} shares of ${name} added to cart`);
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(CartState.items));
    CartState.total = CartState.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function showCartNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'cart-notification';
    notif.textContent = message;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.classList.add('show'), 10);
    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

function showCartModal() {
    const modal = document.createElement('div');
    modal.className = 'cart-modal';
    modal.id = 'cartModal';
    
    if (CartState.items.length === 0) {
        modal.innerHTML = `
            <div class="cart-modal-overlay" onclick="closeCartModal()"></div>
            <div class="cart-modal-content">
                <div class="cart-modal-header">
                    <h3>Your Cart</h3>
                    <button class="close-btn" onclick="closeCartModal()">&times;</button>
                </div>
                <div class="cart-empty">
                    <div class="cart-empty-icon">🛒</div>
                    <p>Your cart is empty</p>
                    <a href="marketplace.html" class="btn-primary" onclick="closeCartModal()">Browse Fractions</a>
                </div>
            </div>
        `;
    } else {
        const itemsHtml = CartState.items.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-icon">${item.icon}</div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">$${item.price} x ${item.quantity}</div>
                </div>
                <div class="cart-item-total">$${(item.price * item.quantity).toFixed(2)}</div>
                <button class="cart-item-remove" onclick="removeFromCart(${index})">&times;</button>
            </div>
        `).join('');
        
        const total = CartState.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
        
        modal.innerHTML = `
            <div class="cart-modal-overlay" onclick="closeCartModal()"></div>
            <div class="cart-modal-content">
                <div class="cart-modal-header">
                    <h3>Your Cart (${CartState.items.reduce((s, i) => s + i.quantity, 0)} items)</h3>
                    <button class="close-btn" onclick="closeCartModal()">&times;</button>
                </div>
                <div class="cart-items">
                    ${itemsHtml}
                </div>
                <div class="cart-footer">
                    <div class="cart-total-row">
                        <span>Total</span>
                        <span class="cart-total-amount">$${total}</span>
                    </div>
                    <a href="checkout.html" class="btn-primary btn-full" onclick="closeCartModal()">Proceed to Checkout</a>
                    <button class="btn-secondary btn-full" onclick="clearCart()">Clear Cart</button>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

function removeFromCart(index) {
    CartState.items.splice(index, 1);
    saveCart();
    updateCartCount();
    closeCartModal();
    showCartModal();
}

function clearCart() {
    CartState.items = [];
    saveCart();
    updateCartCount();
    closeCartModal();
}

// Make cart functions globally available
window.CartState = CartState;
window.showQuantityModal = showQuantityModal;
window.closeQuantityModal = closeQuantityModal;
window.adjustQuantity = adjustQuantity;
window.addToCartFromModal = addToCartFromModal;
window.showCartModal = showCartModal;
window.closeCartModal = closeCartModal;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;

// ================= BREAK PAYMENT SYSTEM =================

// Wallet State
const BSCState = {
    isConnected: false,
    address: null,
    selectedToken: 'USDC',
    chainId: 56, // BSC Mainnet
    usdcBalance: 0,
    usdtBalance: 0,
    currentBreak: null,
    packQuantity: 1
};

// BSC Contract Addresses (Mainnet)
const BSC_CONTRACTS = {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC_DECIMALS: 18,
    USDT_DECIMALS: 18
};

// Treasury Wallets
const TREASURY_WALLETS = {
    treasury: '0x7a23...9f4e',      // Pack cost return
    operations: '0x8f2a...1b9c',    // 20% operations
    buyback: '0x3c7e...9d2f'       // 20% token buyback
};

// Revenue Distribution Model (Example: $100 payment)
// Pack cost: ~$60 (goes back to treasury for pack purchase)
// Operations: $20 (20%)
// Token Buyback: $20 (20%)
// Platform keeps remainder as profit

let currentBreakData = null;

function openBreakPaymentModal(breakName, price, breakId) {
    currentBreakData = { name: breakName, price: price, id: breakId };
    BSCState.currentBreak = breakId;
    BSCState.packQuantity = 1;
    
    // Update modal content
    document.getElementById('modalBreakName').textContent = breakName;
    document.getElementById('modalBreakPrice').textContent = price.toFixed(2);
    document.getElementById('packQuantity').value = 1;
    
    updatePaymentCalculations();
    
    // Show modal
    const modal = document.getElementById('breakPaymentModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBreakPaymentModal() {
    const modal = document.getElementById('breakPaymentModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Reset state
    BSCState.packQuantity = 1;
    if (!BSCState.isConnected) {
        document.getElementById('walletStatus').style.display = 'none';
        document.getElementById('tokenSelection').style.display = 'none';
        document.getElementById('payWithCrypto').disabled = true;
    }
}

function adjustPackQuantity(delta) {
    const input = document.getElementById('packQuantity');
    const newValue = parseInt(input.value) + delta;
    const maxPacks = 36; // Can be dynamic based on break
    
    if (newValue >= 1 && newValue <= maxPacks) {
        input.value = newValue;
        BSCState.packQuantity = newValue;
        updatePaymentCalculations();
    }
}

function updatePaymentCalculations() {
    if (!currentBreakData) return;
    
    const quantity = BSCState.packQuantity;
    const packPrice = currentBreakData.price;
    const totalRevenue = quantity * packPrice;
    
    // Cost base goes to operations wallet (to rebuy packs for next break)
    // Example: £15 sale price, £10 cost base = £5 profit
    const packCostBase = quantity * 10.00; // £10 cost per pack
    const profit = totalRevenue - packCostBase;
    
    // Split profit:
    // 50% Treasury (eco system support - staking rewards, coin pegging)
    // 20% Operations Wallet (wages, web services, stock, shipping)
    // 20% Token Liquidity Vault (building to 25K for token launch)
    // 10% Investment Vault (pack buyouts, farming, etc)
    const treasuryShare = profit * 0.50;
    const operationsShare = profit * 0.20;
    const tokenLiquidityShare = profit * 0.20;
    const investmentVaultShare = profit * 0.10;
    
    // Update UI
    document.getElementById('modalTotalPrice').textContent = totalRevenue.toFixed(2);
    document.getElementById('cryptoPayAmount').textContent = totalRevenue.toFixed(2);
    
    // Show breakdown
    document.getElementById('costToOpsAmount').textContent = 'Pack Cost to Ops: £' + packCostBase.toFixed(2);
    document.getElementById('treasuryAmount').textContent = 'Treasury (50%): £' + treasuryShare.toFixed(2);
    document.getElementById('operationsAmount').textContent = 'Operations (20%): £' + operationsShare.toFixed(2);
    document.getElementById('tokenLiquidityAmount').textContent = 'Token Liquidity (20%): £' + tokenLiquidityShare.toFixed(2);
    document.getElementById('investmentAmount').textContent = 'Investment Vault (10%): £' + investmentVaultShare.toFixed(2);
}

function switchPaymentTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.payment-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.payment-tab').classList.add('active');
    
    // Show/hide content
    document.getElementById('cryptoPayment').classList.toggle('hidden', tab !== 'crypto');
    document.getElementById('fiatPayment').classList.toggle('hidden', tab !== 'fiat');
}

async function connectBSCWallet() {
    try {
        // Check if MetaMask or other Web3 wallet is installed
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask or another Web3 wallet to pay with crypto');
            return;
        }
        
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length === 0) {
            alert('No accounts found. Please unlock your wallet.');
            return;
        }
        
        // Check if we're on BSC
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const currentChainId = parseInt(chainId, 16);
        
        if (currentChainId !== BSCState.chainId) {
            // Try to switch to BSC
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x38' }] // BSC Mainnet
                });
            } catch (switchError) {
                // If BSC is not added, add it
                if (switchError.code === 4902) {
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
                            blockExplorerUrls: ['https://bscscan.com']
                        }]
                    });
                } else {
                    throw switchError;
                }
            }
        }
        
        // Update state
        BSCState.isConnected = true;
        BSCState.address = accounts[0];
        
        // Update UI
        document.getElementById('walletStatus').style.display = 'flex';
        document.getElementById('walletAddress').textContent = 
            BSCState.address.substring(0, 6) + '...' + BSCState.address.substring(38);
        document.getElementById('connectBSCWallet').textContent = 'Wallet Connected';
        document.getElementById('connectBSCWallet').disabled = true;
        
        // Show token selection
        document.getElementById('tokenSelection').style.display = 'block';
        
        // Fetch balances (mock for now)
        await fetchTokenBalances();
        
        // Enable pay button
        document.getElementById('payWithCrypto').disabled = false;
        
    } catch (error) {
        console.error('Wallet connection failed:', error);
        alert('Failed to connect wallet: ' + error.message);
    }
}

async function fetchTokenBalances() {
    // In a real implementation, you would call the BSC contracts
    // For demo purposes, showing mock balances
    
    // This would be replaced with actual contract calls:
    // const usdcContract = new web3.eth.Contract(ERC20_ABI, BSC_CONTRACTS.USDC);
    // const usdcBalance = await usdcContract.methods.balanceOf(BSCState.address).call();
    
    BSCState.usdcBalance = 150.50; // Mock balance
    BSCState.usdtBalance = 200.00; // Mock balance
    
    document.getElementById('usdcBalance').textContent = BSCState.usdcBalance.toFixed(2);
    document.getElementById('usdtBalance').textContent = BSCState.usdtBalance.toFixed(2);
    document.getElementById('walletBalance').textContent = 
        `USDC: ${BSCState.usdcBalance.toFixed(2)} | USDT: ${BSCState.usdtBalance.toFixed(2)}`;
}

function selectToken(token) {
    BSCState.selectedToken = token;
    
    // Update UI
    document.querySelectorAll('.token-option').forEach(opt => {
        opt.classList.remove('active');
    });
    event.target.closest('.token-option').classList.add('active');
    
    // Update pay button
    const totalPrice = document.getElementById('modalTotalPrice').textContent;
    document.getElementById('cryptoPayAmount').textContent = totalPrice;
    document.getElementById('payWithCrypto').innerHTML = 
        `Pay $${totalPrice} ${token}`;
}

async function processCryptoPayment() {
    if (!BSCState.isConnected) {
        alert('Please connect your wallet first');
        return;
    }
    
    const totalAmount = parseFloat(document.getElementById('modalTotalPrice').textContent);
    const selectedBalance = BSCState.selectedToken === 'USDC' ? BSCState.usdcBalance : BSCState.usdtBalance;
    
    if (selectedBalance < totalAmount) {
        alert(`Insufficient ${BSCState.selectedToken} balance. You have ${selectedBalance.toFixed(2)} ${BSCState.selectedToken} but need ${totalAmount.toFixed(2)}.`);
        return;
    }
    
    // Show status modal
    showPaymentStatus('processing');
    
    try {
        // In a real implementation:
        // 1. Create a transaction to send USDC/USDT to a smart contract
        // 2. The smart contract would automatically distribute funds:
        //    - 60% to treasury wallet (pack cost)
        //    - 20% to operations wallet
        //    - 20% to buyback wallet
        // 3. The contract emits an event with the break details
        
        // For demo, simulate transaction
        await simulateTransaction();
        
        // Show success
        showPaymentStatus('success', '0x' + Math.random().toString(16).substr(2, 40));
        
        // Add to user's breaks (would be handled by backend in production)
        addBreakToUserHistory();
        
    } catch (error) {
        console.error('Payment failed:', error);
        showPaymentStatus('failed', null, error.message);
    }
}

async function processFiatPayment(method) {
    // Show status modal
    showPaymentStatus('processing');
    
    // In a real implementation:
    // 1. Call Stripe/Payment processor API
    // 2. On successful payment, backend converts fiat to USDC
    // 3. Backend distributes USDC to treasury wallets
    // 4. Backend records the break purchase
    
    // For demo, simulate processing
    setTimeout(() => {
        showPaymentStatus('success', 'pi_' + Math.random().toString(36).substr(2, 24));
        addBreakToUserHistory();
    }, 2000);
}

async function simulateTransaction() {
    // Simulate transaction delay
    return new Promise(resolve => setTimeout(resolve, 2000));
}

function showPaymentStatus(status, txHash = null, errorMessage = null) {
    const modal = document.getElementById('paymentStatusModal');
    const icon = document.getElementById('statusIcon');
    const title = document.getElementById('statusTitle');
    const message = document.getElementById('statusMessage');
    const hashDiv = document.getElementById('txHash');
    const btn = document.getElementById('statusBtn');
    
    modal.classList.add('active');
    
    if (status === 'processing') {
        icon.textContent = '⏳';
        title.textContent = 'Processing Payment';
        message.textContent = 'Please confirm the transaction in your wallet...';
        hashDiv.style.display = 'none';
        btn.style.display = 'none';
    } else if (status === 'success') {
        icon.textContent = '✅';
        title.textContent = 'Payment Successful!';
        message.textContent = 'Your pack slots have been reserved. You will receive an email confirmation shortly.';
        if (txHash) {
            hashDiv.style.display = 'block';
            hashDiv.innerHTML = `<a href="https://bscscan.com/tx/${txHash}" target="_blank">View Transaction: ${txHash.substring(0, 15)}...</a>`;
        }
        btn.style.display = 'block';
        btn.textContent = 'Continue';
        
        // Close payment modal
        closeBreakPaymentModal();
    } else if (status === 'failed') {
        icon.textContent = '❌';
        title.textContent = 'Payment Failed';
        message.textContent = errorMessage || 'Something went wrong. Please try again.';
        hashDiv.style.display = 'none';
        btn.style.display = 'block';
        btn.textContent = 'Try Again';
    }
}

function closePaymentStatus() {
    const modal = document.getElementById('paymentStatusModal');
    modal.classList.remove('active');
}

function addBreakToUserHistory() {
    // In production, this would be handled by the backend
    // For demo, we'll just log it
    console.log('Break added to user history:', currentBreakData, 'Quantity:', BSCState.packQuantity);
    
    // You could update localStorage here to track user's breaks
    const userBreaks = JSON.parse(localStorage.getItem('userBreaks') || '[]');
    userBreaks.push({
        ...currentBreakData,
        quantity: BSCState.packQuantity,
        purchaseDate: new Date().toISOString(),
        status: 'confirmed'
    });
    localStorage.setItem('userBreaks', JSON.stringify(userBreaks));
}

// Make break payment functions globally available
window.openBreakPaymentModal = openBreakPaymentModal;
window.closeBreakPaymentModal = closeBreakPaymentModal;
window.adjustPackQuantity = adjustPackQuantity;
window.switchPaymentTab = switchPaymentTab;
window.connectBSCWallet = connectBSCWallet;
window.selectToken = selectToken;
window.processCryptoPayment = processCryptoPayment;
window.processFiatPayment = processFiatPayment;
window.closePaymentStatus = closePaymentStatus;

// ================= BUYOUT SYSTEM =================

// Buyout State
const BuyoutState = {
    currentCard: null,
    userOwnership: 0, // percentage user owns
    buyoutValue: 0,
    platformFee: 0.025 // 2.5% fee
};

function showBuyoutModal(cardId, cardName, vaultValue, buyoutValue, totalShares) {
    // In production, fetch user's actual ownership from backend
    // For demo, showing example calculations
    const userOwnershipPercent = 10; // Example: user owns 10%
    const userShareValue = buyoutValue * (userOwnershipPercent / 100);
    const platformFee = userShareValue * BuyoutState.platformFee;
    const userPayout = userShareValue - platformFee;
    
    // Calculate fee distribution (same as breaks)
    const feeToTreasury = platformFee * 0.50;
    const feeToOperations = platformFee * 0.20;
    const feeToTokenLiquidity = platformFee * 0.20;
    const feeToInvestment = platformFee * 0.10;
    
    // Create buyout modal
    const modal = document.createElement('div');
    modal.className = 'buyout-modal';
    modal.id = 'buyoutModal';
    modal.innerHTML = `
        <div class="cart-modal-overlay" onclick="closeBuyoutModal()"></div>
        <div class="cart-modal-content" style="max-width: 450px;">
            <div class="cart-modal-header">
                <h3>Card Buyout Offer</h3>
                <button class="close-btn" onclick="closeBuyoutModal()">&times;</button>
            </div>
            <div class="cart-modal-body" style="padding: 1.5rem;">
                <div class="quantity-item">
                    <div class="quantity-icon">🎴</div>
                    <div class="quantity-info">
                        <div class="quantity-name">${cardName}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">
                            Vault Value: £${parseInt(vaultValue).toLocaleString()}
                        </div>
                    </div>
                </div>
                
                <div class="buyout-details">
                    <div class="buyout-detail-row">
                        <span>Buyout Offer</span>
                        <span>£${parseInt(buyoutValue).toLocaleString()}</span>
                    </div>
                    <div class="buyout-detail-row">
                        <span>Your Ownership</span>
                        <span>${userOwnershipPercent}%</span>
                    </div>
                    <div class="buyout-detail-row">
                        <span>Your Share Value</span>
                        <span>£${userShareValue.toFixed(2)}</span>
                    </div>
                    <div class="buyout-detail-row fee">
                        <span>Platform Fee (2.5%)</span>
                        <span>-£${platformFee.toFixed(2)}</span>
                    </div>
                    <div class="buyout-detail-row" style="border-top: 2px solid var(--border-color); margin-top: 0.5rem; padding-top: 0.75rem;">
                        <span>Your Payout</span>
                        <span>£${userPayout.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="fee-distribution">
                    <h5>Fee Distribution</h5>
                    <div class="fee-row">
                        <span>Treasury (50%)</span>
                        <span>£${feeToTreasury.toFixed(2)}</span>
                    </div>
                    <div class="fee-row">
                        <span>Operations (20%)</span>
                        <span>£${feeToOperations.toFixed(2)}</span>
                    </div>
                    <div class="fee-row">
                        <span>Token Liquidity (20%)</span>
                        <span>£${feeToTokenLiquidity.toFixed(2)}</span>
                    </div>
                    <div class="fee-row">
                        <span>Investment Vault (10%)</span>
                        <span>£${feeToInvestment.toFixed(2)}</span>
                    </div>
                </div>
                
                <div style="background: rgba(255, 222, 0, 0.1); border: 1px solid var(--accent-yellow); border-radius: 8px; padding: 1rem; margin: 1rem 0; font-size: 0.85rem;">
                    <strong style="color: var(--accent-yellow);">Voting Required:</strong> 
                    51% ownership must approve this buyout. If accepted, you'll receive your payout within 24 hours.
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button class="btn-secondary" style="flex: 1;" onclick="closeBuyoutModal()">Decline</button>
                    <button class="btn-primary" style="flex: 1;" onclick="voteOnBuyout('${cardId}', true)">Approve Buyout</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeBuyoutModal() {
    const modal = document.getElementById('buyoutModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

function voteOnBuyout(cardId, approve) {
    // In production, this would:
    // 1. Record user's vote on-chain or in backend
    // 2. Check if 51% threshold reached
    // 3. If approved, execute buyout and distribute funds
    
    if (approve) {
        showNotification('Vote recorded: You approved the buyout. Waiting for 51% consensus...', 'success');
    } else {
        showNotification('Vote recorded: You declined the buyout.', 'info');
    }
    
    closeBuyoutModal();
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: ${type === 'success' ? 'var(--accent-green)' : type === 'error' ? '#dc2626' : 'var(--accent-blue)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 3000;
        transition: transform 0.3s ease;
        font-weight: 500;
        max-width: 90%;
        text-align: center;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Make buyout functions globally available
window.showBuyoutModal = showBuyoutModal;
window.closeBuyoutModal = closeBuyoutModal;
window.voteOnBuyout = voteOnBuyout;

// Pre-Sale Popup Functions
function showPresalePopup() {
    const modal = document.getElementById('presalePopupModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closePresalePopup() {
    const modal = document.getElementById('presalePopupModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Show pre-sale popup after 3 seconds on breaks page
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('breaks.html')) {
        setTimeout(() => {
            showPresalePopup();
        }, 3000);
    }
});

window.showPresalePopup = showPresalePopup;
window.closePresalePopup = closePresalePopup;
