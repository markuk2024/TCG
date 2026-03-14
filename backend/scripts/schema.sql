-- TCG Vault Protocol Database Schema
-- Run this to create all tables for the platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table with KYC and wallet info
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'required')),
    kyc_verified_at TIMESTAMP,
    wallet_address VARCHAR(42) UNIQUE, -- Ethereum address
    wallet_encrypted_key TEXT, -- Encrypted private key for custodial wallet
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User balances (tokens and fiat)
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_balance DECIMAL(20, 8) DEFAULT 0, -- $VAULT tokens
    staked_balance DECIMAL(20, 8) DEFAULT 0,
    pending_rewards DECIMAL(20, 8) DEFAULT 0,
    fiat_balance_gbp DECIMAL(12, 2) DEFAULT 0,
    fiat_balance_usd DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Breaks (live box breaks)
CREATE TABLE IF NOT EXISTS breaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    product_type VARCHAR(50) NOT NULL, -- 'pokemon', 'magic', 'yugioh', etc.
    product_name VARCHAR(255) NOT NULL,
    total_packs INTEGER NOT NULL,
    packs_available INTEGER NOT NULL,
    pack_price_gbp DECIMAL(10, 2) NOT NULL,
    pack_price_usd DECIMAL(10, 2) NOT NULL,
    break_type VARCHAR(20) DEFAULT 'pack' CHECK (break_type IN ('pack', 'box', 'case')),
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    stream_url VARCHAR(500),
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    platform_fee DECIMAL(12, 2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Break spots/purchases
CREATE TABLE IF NOT EXISTS break_spots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    break_id UUID REFERENCES breaks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    spot_number INTEGER NOT NULL,
    pack_numbers INTEGER[], -- Which packs the user gets
    price_paid_gbp DECIMAL(10, 2) NOT NULL,
    price_paid_usd DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'refunded', 'failed')),
    stripe_payment_intent_id VARCHAR(255),
    pulled_cards JSONB DEFAULT '[]', -- Array of cards pulled from this spot
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(break_id, spot_number)
);

-- Vault items (physical cards/assets)
CREATE TABLE IF NOT EXISTS vault_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    card_set VARCHAR(100),
    card_number VARCHAR(20),
    grade VARCHAR(10), -- PSA/BGS grade
    grading_company VARCHAR(20),
    condition VARCHAR(20),
    category VARCHAR(50), -- 'pokemon', 'magic', 'sports', etc.
    purchase_price_gbp DECIMAL(12, 2),
    purchase_price_usd DECIMAL(12, 2),
    current_market_value_gbp DECIMAL(12, 2),
    current_market_value_usd DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'GBP',
    storage_location VARCHAR(50),
    status VARCHAR(20) DEFAULT 'in_vault' CHECK (status IN ('in_vault', 'fractionalized', 'sold', 'removed')),
    acquired_from VARCHAR(255),
    acquisition_date DATE,
    images TEXT[],
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fractional ownership shares
CREATE TABLE IF NOT EXISTS fractional_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vault_item_id UUID REFERENCES vault_items(id) ON DELETE CASCADE,
    total_shares INTEGER NOT NULL,
    share_price_gbp DECIMAL(10, 2) NOT NULL,
    share_price_usd DECIMAL(10, 2) NOT NULL,
    available_shares INTEGER NOT NULL,
    trading_enabled BOOLEAN DEFAULT FALSE,
    ipo_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User share holdings
CREATE TABLE IF NOT EXISTS user_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    fractional_share_id UUID REFERENCES fractional_shares(id) ON DELETE CASCADE,
    shares_owned INTEGER NOT NULL DEFAULT 0,
    purchase_price_avg_gbp DECIMAL(10, 2),
    purchase_price_avg_usd DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, fractional_share_id)
);

-- Marketplace listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    fractional_share_id UUID REFERENCES fractional_shares(id) ON DELETE CASCADE,
    shares_amount INTEGER NOT NULL,
    price_per_share_gbp DECIMAL(10, 2) NOT NULL,
    price_per_share_usd DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
    listed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sold_at TIMESTAMP,
    buyer_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staking positions
CREATE TABLE IF NOT EXISTS staking_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount_staked DECIMAL(20, 8) NOT NULL,
    staked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_reward_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_rewards_earned DECIMAL(20, 8) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    unstaked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staking reward distributions
CREATE TABLE IF NOT EXISTS staking_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distribution_period_start DATE NOT NULL,
    distribution_period_end DATE NOT NULL,
    total_reward_pool DECIMAL(20, 8) NOT NULL,
    total_staked_amount DECIMAL(20, 8) NOT NULL,
    apy_rate DECIMAL(5, 2) NOT NULL,
    distributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_hash VARCHAR(66) -- Blockchain tx hash
);

-- Individual user staking rewards
CREATE TABLE IF NOT EXISTS user_staking_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    staking_reward_id UUID REFERENCES staking_rewards(id) ON DELETE CASCADE,
    staking_position_id UUID REFERENCES staking_positions(id) ON DELETE CASCADE,
    amount DECIMAL(20, 8) NOT NULL,
    claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    stripe_payment_intent_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    amount_gbp DECIMAL(12, 2) NOT NULL,
    amount_usd DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'break_purchase', 'token_purchase', 'deposit', etc.
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    metadata JSONB, -- Additional payment data
    receipt_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Treasury transactions
CREATE TABLE IF NOT EXISTS treasury_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL, -- 'revenue', 'expense', 'buyback', 'staking_rewards', 'operations'
    category VARCHAR(50) NOT NULL,
    amount_gbp DECIMAL(12, 2),
    amount_usd DECIMAL(12, 2),
    amount_token DECIMAL(20, 8),
    token_price_at_tx DECIMAL(10, 8),
    description TEXT,
    related_break_id UUID REFERENCES breaks(id),
    related_payment_id UUID REFERENCES payments(id),
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Token buybacks
CREATE TABLE IF NOT EXISTS token_buybacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount_tokens DECIMAL(20, 8) NOT NULL,
    price_per_token_gbp DECIMAL(10, 8) NOT NULL,
    total_cost_gbp DECIMAL(12, 2) NOT NULL,
    dex_used VARCHAR(50), -- 'uniswap', 'sushiswap', etc.
    transaction_hash VARCHAR(66) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    buyback_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User activity log
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- 'break', 'vault_item', 'payment', etc.
    entity_id UUID,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_kyc ON users(kyc_status);
CREATE INDEX idx_breaks_status ON breaks(status);
CREATE INDEX idx_breaks_scheduled ON breaks(scheduled_at);
CREATE INDEX idx_break_spots_break ON break_spots(break_id);
CREATE INDEX idx_break_spots_user ON break_spots(user_id);
CREATE INDEX idx_vault_items_status ON vault_items(status);
CREATE INDEX idx_vault_items_category ON vault_items(category);
CREATE INDEX idx_fractional_shares_item ON fractional_shares(vault_item_id);
CREATE INDEX idx_user_shares_user ON user_shares(user_id);
CREATE INDEX idx_marketplace_seller ON marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX idx_staking_user ON staking_positions(user_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id);
CREATE INDEX idx_treasury_type ON treasury_transactions(type);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at);

-- Update timestamps function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_balances_updated_at BEFORE UPDATE ON user_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_breaks_updated_at BEFORE UPDATE ON breaks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vault_items_updated_at BEFORE UPDATE ON vault_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fractional_shares_updated_at BEFORE UPDATE ON fractional_shares FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_shares_updated_at BEFORE UPDATE ON user_shares FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staking_positions_updated_at BEFORE UPDATE ON staking_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password should be changed immediately)
-- Password: 'admin123' (hashed with bcrypt)
INSERT INTO users (email, password_hash, first_name, last_name, is_admin, kyc_status, email_verified)
VALUES (
    'admin@tcgvaultprotocol.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G',
    'Admin',
    'User',
    TRUE,
    'verified',
    TRUE
) ON CONFLICT (email) DO NOTHING;
