# TCG Vault Protocol - Technical Architecture Blueprint

## Executive Summary

**TCG Vault Protocol** is a comprehensive trading card collecting platform that bridges traditional card collecting with modern fractional ownership and blockchain technology. This document outlines the complete technical architecture, system design, and implementation roadmap.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Website    │  │  Admin Panel │  │  Mobile App  │          │
│  │  (Frontend)  │  │  (Frontend)  │  │  (Future)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼────────────────────┘
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Express.js REST API  │  Rate Limiting  │  Authentication       │
│  CORS Enabled         │  Helmet Security│  JWT + Refresh Tokens │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Breaks     │  │    Vault     │  │ Marketplace  │          │
│  │   Service    │  │   Service    │  │   Service    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Staking    │  │   Treasury   │  │   Payment    │          │
│  │   Service    │  │   Service    │  │   Service    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                      DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL Database  │  Redis Cache (Future)  │  File Storage   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   BLOCKCHAIN LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  ERC20 Token Contract  │  Treasury Wallet  │  DEX Integration   │
│  Smart Contract Logic    │  Custodial Wallets  │  Buyback Logic  │
└─────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   PAYMENT LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  Stripe (Primary)  │  MoonPay  │  Coinbase Commerce           │
│  Card Payments       │  Crypto On-ramp  │  Alternative Gateway    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Technology Stack
- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Flexbox, Grid
- **JavaScript** - Vanilla ES6+
- **Google Fonts** - Inter font family

### Page Structure
| Page | File | Purpose | Pokemon Watermark |
|------|------|---------|-------------------|
| Home | `index.html` | Landing, Hero, How It Works | Pikachu |
| Breaks | `breaks.html` | Live box breaks, countdowns | Charmander |
| Vault | `vault.html` | Treasury assets, revenue flywheel | Mewtwo |
| Marketplace | `marketplace.html` | Fractional trading | Squirtle |
| Token | `token.html` | $VAULT token, staking | Charizard |
| Roadmap | `roadmap.html` | Development phases | Bulbasaur |

### Design System
```css
/* Color Palette - Pokemon Theme */
--bg-primary: #0a0a1f      /* Dark blue-black */
--bg-secondary: #121230    /* Card backgrounds */
--bg-card: #1a1a40         /* Elevated surfaces */
--accent-blue: #3B4CCA     /* Pokemon blue */
--accent-yellow: #FFDE00   /* Pokemon yellow */
--text-primary: #ffffff    /* Headings */
--text-secondary: #a0a0c0  /* Body text */
--text-muted: #6b6b8b      /* Subtle text */
```

---

## Backend Architecture

### Technology Stack
- **Node.js** v18+ - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Primary database
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **Stripe** - Payment processing
- **Ethers.js** - Blockchain interaction

### Project Structure
```
backend/
├── server.js              # Entry point
├── config/
│   └── database.js        # PostgreSQL connection
├── middleware/
│   ├── auth.js            # JWT authentication
│   ├── errorHandler.js    # Global error handling
│   └── rateLimiter.js     # Rate limiting
├── routes/
│   ├── auth.js            # Registration, login
│   ├── users.js           # User management
│   ├── breaks.js          # Box breaks
│   ├── vault.js           # Vault items
│   ├── marketplace.js     # Fractional trading
│   ├── staking.js         # Staking rewards
│   ├── payments.js        # Stripe integration
│   └── treasury.js        # Treasury management
├── scripts/
│   ├── schema.sql         # Database schema
│   └── migrate.js         # Migration runner
└── package.json
```

### API Endpoints

#### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | User registration | No |
| POST | `/login` | User login | No |
| POST | `/refresh` | Refresh access token | No |
| POST | `/logout` | Logout | Yes |
| POST | `/change-password` | Change password | Yes |

#### Users (`/api/users`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/me` | Get current user profile | Yes |
| PUT | `/me` | Update profile | Yes |
| GET | `/me/activity` | Get activity log | Yes |
| GET | `/me/breaks` | Get user's break purchases | Yes |
| GET | `/me/shares` | Get fractional holdings | Yes |
| GET | `/me/staking` | Get staking positions | Yes |
| GET | `/` | List all users (admin) | Admin |
| PUT | `/:id/kyc` | Update KYC status (admin) | Admin |

#### Breaks (`/api/breaks`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List all breaks | No |
| GET | `/:id` | Get break details | No |
| POST | `/:id/purchase` | Purchase break spots | Yes |
| POST | `/` | Create new break (admin) | Admin |
| PUT | `/:id` | Update break (admin) | Admin |
| POST | `/:id/record-pulls` | Record card pulls (admin) | Admin |

#### Vault (`/api/vault`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/items` | List vault items | No |
| GET | `/items/:id` | Get item details | No |
| POST | `/items` | Add item (admin) | Admin |
| PUT | `/items/:id` | Update item (admin) | Admin |
| POST | `/items/:id/fractionalize` | Create shares (admin) | Admin |
| GET | `/treasury` | Treasury overview | No |

#### Marketplace (`/api/marketplace`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/listings` | Get active listings | No |
| GET | `/listings/:id` | Get listing details | No |
| POST | `/listings` | Create listing | Yes |
| POST | `/listings/:id/buy` | Buy shares | Yes |
| DELETE | `/listings/:id` | Cancel listing | Yes |
| PUT | `/shares/:id/enable-trading` | Enable trading (admin) | Admin |

#### Staking (`/api/staking`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/info` | Get staking pool info | No |
| GET | `/my-positions` | Get user's positions | Yes |
| POST | `/stake` | Stake tokens | Yes |
| POST | `/unstake/:id` | Unstake tokens | Yes |
| GET | `/rewards` | Get reward history | Yes |
| POST | `/claim-rewards` | Claim rewards | Yes |
| POST | `/distribute` | Distribute rewards (admin) | Admin |

#### Payments (`/api/payments`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/create-intent` | Create payment intent | Yes |
| GET | `/history` | Get payment history | Yes |
| POST | `/webhook` | Stripe webhook handler | No |
| GET | `/all` | Get all payments (admin) | Admin |
| POST | `/refund` | Process refund (admin) | Admin |

#### Treasury (`/api/treasury`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/overview` | Treasury overview | No |
| GET | `/transactions` | Get transactions | No |
| POST | `/transaction` | Record transaction (admin) | Admin |
| POST | `/execute-buyback` | Execute buyback (admin) | Admin |
| GET | `/performance` | Performance metrics | Admin |

---

## Database Schema

### Core Tables

#### `users`
Primary user accounts with KYC and wallet info.
```sql
- id: UUID (PK)
- email: VARCHAR(255) UNIQUE
- password_hash: VARCHAR(255)
- first_name, last_name: VARCHAR(100)
- phone: VARCHAR(50)
- kyc_status: VARCHAR(20) - pending/verified/rejected
- wallet_address: VARCHAR(42) - Ethereum address
- wallet_encrypted_key: TEXT - Encrypted private key
- is_admin, is_active: BOOLEAN
- timestamps
```

#### `user_balances`
Token and fiat balances per user.
```sql
- token_balance: DECIMAL(20,8) - $VAULT tokens
- staked_balance: DECIMAL(20,8)
- pending_rewards: DECIMAL(20,8)
- fiat_balance_gbp, fiat_balance_usd: DECIMAL(12,2)
```

#### `breaks`
Live box break events.
```sql
- name, description, product_type, product_name
- total_packs, packs_available
- pack_price_gbp, pack_price_usd
- status: upcoming/live/completed/cancelled
- scheduled_at, stream_url
```

#### `break_spots`
Individual spot purchases in breaks.
```sql
- break_id, user_id, spot_number
- pack_numbers: INTEGER[]
- price_paid_gbp, price_paid_usd
- payment_status, stripe_payment_intent_id
- pulled_cards: JSONB
```

#### `vault_items`
Physical assets in the vault.
```sql
- name, card_set, card_number
- grade, grading_company, condition
- category: pokemon/magic/yugioh/etc.
- purchase_price_gbp/usd, current_market_value_gbp/usd
- storage_location, status, images: TEXT[]
```

#### `fractional_shares`
Fractional ownership shares for vault items.
```sql
- vault_item_id: UUID (FK)
- total_shares, available_shares
- share_price_gbp, share_price_usd
- trading_enabled, ipo_date
```

#### `user_shares`
User holdings of fractional shares.
```sql
- user_id, fractional_share_id
- shares_owned
- purchase_price_avg_gbp/usd
```

#### `marketplace_listings`
Active marketplace listings.
```sql
- seller_id, fractional_share_id
- shares_amount, price_per_share_gbp/usd
- status: active/sold/cancelled
- listed_at, sold_at, buyer_id
```

#### `staking_positions`
Active token staking positions.
```sql
- user_id, amount_staked
- staked_at, last_reward_at
- total_rewards_earned, is_active
```

#### `staking_rewards` & `user_staking_rewards`
Reward distribution tracking.
```sql
- distribution_period_start/end
- total_reward_pool, total_staked_amount, apy_rate
- Individual user reward amounts and claim status
```

#### `payments`
Payment transaction records.
```sql
- user_id, stripe_payment_intent_id, stripe_customer_id
- amount_gbp/usd, currency, type, status
- metadata: JSONB, receipt_url
```

#### `treasury_transactions`
All treasury financial transactions.
```sql
- type: revenue/expense/buyback/staking_rewards/operations
- category, amount_gbp/usd/token, token_price_at_tx
- related_break_id, related_payment_id, blockchain_tx_hash
```

#### `token_buybacks`
Token buyback records.
```sql
- amount_tokens, price_per_token_gbp, total_cost_gbp
- dex_used, transaction_hash, buyback_date
```

---

## Business Logic

### Revenue Flow
```
1. Customer Purchase
   └─> Stripe Payment
       └─> 50% → Treasury
           30% → Token Buybacks
           20% → Operations
```

### Staking Rewards
```
1. Monthly Revenue Allocation
   └─> Reward Pool Created
       └─> Proportional Distribution
           └─> Stakers Claim Rewards
```

### Fractional Trading
```
1. Card Fractionalization
   └─> Shares Created (e.g., 20,000)
       └─> IPO (Initial Purchase)
           └─> Secondary Market Trading
               └─> 2.5% Platform Fee
```

### Break Process
```
1. Box Added to Inventory
   └─> Break Scheduled
       └─> Spots Purchased
           └─> Live Stream Opening
               └─> Cards Distributed
                   └─> Revenue Recorded
```

---

## Security Architecture

### Authentication
- **JWT Access Tokens** - 7 day expiration
- **Refresh Tokens** - 30 day expiration
- **bcrypt Password Hashing** - 12 rounds
- **Rate Limiting** - 100 requests per 15 minutes

### Authorization
- **Role-based Access** - User vs Admin
- **KYC Requirements** - For certain actions
- **Resource Ownership** - Users can only modify own data

### Data Protection
- **Helmet.js** - Security headers
- **CORS** - Whitelist frontend origin
- **Input Validation** - express-validator
- **SQL Injection Prevention** - Parameterized queries
- **Encrypted Wallet Keys** - AES-256 encryption

### Financial Security
- **Stripe Webhook Verification** - HMAC signature
- **Transaction Atomicity** - Database transactions
- **Double-entry Accounting** - All financial records
- **Audit Logging** - All admin actions logged

---

## Blockchain Integration

### Smart Contracts
- **ERC20 Token Contract** - $VAULT token
- **Treasury Wallet** - Multi-sig recommended
- **Staking Contract** - Reward distribution logic

### Token Economics
```
Total Supply: 10,000,000 $VAULT

Utility:
- Break discounts
- Staking rewards (24% APY target)
- Governance voting
- Marketplace trading

Deflationary Mechanisms:
- Monthly buybacks (30% of revenue)
- Token burns (optional)
```

### Treasury Wallet
- **Public Address** - Transparent holdings
- **Multi-sig** - Require multiple approvals for large transfers
- **Cold Storage** - Majority of funds offline

---

## Payment Processing

### Primary: Stripe
- Card payments (GBP/USD)
- PCI DSS compliant
- Webhook integration for async processing

### Crypto On-ramps (Future)
- MoonPay - Credit card → Crypto
- Coinbase Commerce - Direct crypto

### Revenue Allocation (Automatic)
```
Per £100 Sale:
- £50 → Treasury (vault acquisitions)
- £30 → Token Buybacks
- £20 → Operations (salaries, infrastructure)
```

---

## Deployment Architecture

### Production Setup
```
Frontend: Netlify (CDN)
Backend: AWS/Heroku/DigitalOcean
Database: PostgreSQL (AWS RDS/Supabase)
Blockchain: Polygon Mainnet (low gas fees)
Payments: Stripe Live Mode
```

### Environment Variables
See `backend/.env.example` for complete configuration.

Key variables:
- `JWT_SECRET` - Strong random string
- `STRIPE_SECRET_KEY` - Live or test key
- `DB_PASSWORD` - Database credentials
- `TREASURY_WALLET_PRIVATE_KEY` - Encrypted

---

## Development Roadmap

### Phase 1: MVP (Current)
✅ Static website with all pages
✅ Node.js backend foundation
✅ PostgreSQL database schema
✅ Authentication system
✅ Break management
✅ Vault inventory
✅ Basic staking UI

### Phase 2: Core Features (Next)
🔲 Stripe payment integration
🔲 Live break streaming integration
🔲 Fractional share trading
🔲 Token smart contract deployment
🔲 Custodial wallet system
🔲 KYC integration

### Phase 3: Advanced Features
🔲 Mobile app
🔲 Secondary market order book
🔲 Governance voting system
🔲 Advanced analytics dashboard
🔲 Multi-chain support
🔲 API for third-party integrations

### Phase 4: Scale
🔲 Multi-region deployment
🔲 Microservices architecture
🔲 AI-powered pricing
🔲 Automated trading strategies
🔲 Institutional features

---

## API Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public (GET) | 100 requests | 15 minutes |
| Authenticated | 200 requests | 15 minutes |
| Admin | 500 requests | 15 minutes |
| Webhooks | No limit | N/A |

---

## Error Handling

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (no permission)
- `404` - Not Found
- `409` - Conflict (duplicate/already exists)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

### Error Response Format
```json
{
  "error": "Error Type",
  "message": "Human-readable description",
  "details": [...] // Optional validation errors
}
```

---

## Testing Strategy

### Unit Tests
- Service layer functions
- Database queries
- Utility functions

### Integration Tests
- API endpoint testing
- Database transactions
- Payment webhooks

### End-to-End Tests
- User registration flow
- Complete purchase flow
- Staking/unstaking flow

---

## Monitoring & Logging

### Application Logs
- Winston logger configured
- Log levels: error, warn, info, debug
- Separate error log file

### Database Monitoring
- Query performance tracking
- Connection pool monitoring
- Slow query detection

### Business Metrics
- Revenue tracking
- User acquisition
- Trading volume
- Staking participation

---

## Compliance

### KYC/AML
- Sumsub or Onfido integration
- Identity verification required for:
  - Large purchases (>£1000)
  - Withdrawals
  - Trading on marketplace

### Data Protection (GDPR)
- User data export capability
- Right to deletion
- Privacy policy
- Cookie consent

### Financial Regulations
- Not a security token (utility token)
- Clear terms of service
- Risk disclosures
- No investment advice

---

## Documentation

### API Documentation
- OpenAPI/Swagger spec (future)
- Postman collection
- This blueprint document

### User Documentation
- FAQ
- How-to guides
- Video tutorials

### Developer Documentation
- API reference
- SDK (future)
- Integration guides

---

## Contact & Support

**Technical Lead:** TCG Vault Protocol Team
**Repository:** `lee project/backend`
**Deployment:** Netlify (frontend), TBD (backend production)

---

*Document Version: 1.0*
*Last Updated: March 8, 2026*
*Status: Architecture Complete, Implementation In Progress*
