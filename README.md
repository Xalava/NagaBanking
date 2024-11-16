# Naga Banking - Banking Software for Modern Banks 

## Overview
Naga Banking is a suite facilitating bank operations when interacting with tokenized assets.

## System Architecture

1. **NagaBank Server**
   - Processes SWIFT messages, verifies payment details and authorisations
   - Triggers smart contract unlocks (or minting)

2. **Smart Contracts**
   - NagaExchange
      - Manages USDC offers and escrow
      - Handles locking/unlocking of funds
      - Controls offer lifecycle
   - Tokenized Deposit Smart Contract
   - Contains current account for each user registered at the bank

3. **Web Interface**
   - Offer creation interface
   - Order book viewing
   - Manages bank dashboard


## Flow Diagram
```
Seller -> makeOffer (Lock USDC) 
                    ↓
Buyer -> Views Offer -> SignalIndent -> Makes SWIFT Payment
                    ↓
NagaBank -> Verifies SWIFT -> Unlocks offers
                    ↓
Buyer triggher payments
```

## Technical Stack

### Smart Contracts
- Dev Framework: Hardhat
- Language: Solidity ^0.8.20

### Bank Server
- Runtime: Node.js
- Database: Ayake

### Frontend
- Framework: Vanilla TypeScript
- CSS Framework: Milligram.io
- Web3 Library: ethers.js
