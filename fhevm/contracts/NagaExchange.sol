// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0 <0.9.0;

// Useful for debugging.
// import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";

contract NagaExchange is Ownable {
    IERC20 public USDC;
    // IERC20 public USDNaga;
    uint public offerCounter;
    uint constant lockTime = 6 hours;

    struct Offer {
        uint amount;
        euint64 IBAN;
        address seller;
        uint lockUntil;
        address bider;
    }

    mapping(uint => Offer) public offers;
    mapping(address => bool) public whitelist;

    event OfferMade(uint offerID, uint amount, string IBAN, address user);
    event OfferLocked(uint offerID, address user);
    event FundsUnlocked(uint offerID, address user);

    constructor(address _usdcAddress) Ownable(msg.sender) {
        USDC = IERC20(_usdcAddress);
        // USDNaga = IERC20(_tokenizedDeposits);
        // [AND:], address _tokenizedDeposits)
        whitelist[msg.sender] = true;
    }

    function makeOffer(uint amount, string memory IBAN) public {
        // Disabled for testing
        // require(
        //     USDC.transferFrom(msg.sender, address(this), amount),
        //     "Transfer failed"
        // );

        offerCounter++;
        offers[offerCounter] = Offer({
            amount: amount,
            IBAN: IBAN,
            seller: msg.sender,
            lockUntil: 0,
            bider: address(0)
        });

        emit OfferMade(offerCounter, amount, IBAN, msg.sender);
    }

    function signalIntend(uint offerID) public {
        Offer storage offer = offers[offerID];
        require(offer.seller != address(0), "Offer does not exist");
        require(offer.lockUntil == 0 || block.timestamp > offer.lockUntil, "Offer is already locked");

        offer.lockUntil = block.timestamp + lockTime;
        offer.bider = msg.sender;
        emit OfferLocked(offerID, msg.sender);
    }

    function unlockFunds(uint offerID) public onlyOwner {
        Offer storage offer = offers[offerID];
        require(offer.seller != address(0), "Offer does not exist");
        // USDC.transfer(offer.bider, offer.amount);
        // offer.lockUntil = 0;
        emit FundsUnlocked(offerID, offer.bider);
    }

    function withdrawFunds(uint offerID) public {
        Offer storage offer = offers[offerID];
        require(offer.bider == msg.sender, "Only the bidder can withdraw the funds");
        USDC.transfer(offer.bider, offer.amount);
        offer.seller = address(0); // Voids the offer
    }
}
