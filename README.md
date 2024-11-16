# Naga Banking - Banking Software for Modern Banks 

![Naga Banking](./frontend/naga-banking.png)

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
- Language: Solidity ^0.8.26
- MPC for privacy of IBANs

### Bank Server
- Runtime: Node.js
- Database: Ayake

### Frontend
- Framework: Vanilla JavaScript
- CSS Framework: Milligram.io
- Web3 Library: ethers.js


## Usage
```sh
npx hardhat compile
npx hardhat node
--
npx hardhat ignition deploy ignition/modules/naga.js --network localhost
liveserver frontend/ # or equivalent
```

### File storage

```sh
docker pull akave/akavelink:latest
docker run -d \
  -p 8000:3000 \
  -e NODE_ADDRESS="connect.akave.ai:5500" \ 
  -e PRIVATE_KEY="your_private_key" \
  akave/akavelink:latest
```

public_node_address" \