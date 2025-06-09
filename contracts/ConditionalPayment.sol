// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Anyone can create a conditional payment, specifying the beneficiary, notary, amount, and expiration.
contract ConditionalPayment {
    IERC20 public immutable token;
    uint256 public paymentCounter;

    enum Status {
        PENDING,
        EXECUTED,
        CANCELLED
    }

    struct Payment {
        address payer;
        address beneficiary;
        address notary;
        uint256 amount;
        uint256 expiration;
        Status status;
    }

    mapping(uint256 => Payment) public payments;

    event ConditionalPaymentCreated(
        uint256 indexed paymentId,
        address indexed payer,
        address indexed beneficiary,
        address notary,
        uint256 amount,
        uint256 expiration
    );

    event PaymentExecuted(uint256 indexed paymentId);
    event PaymentCancelled(uint256 indexed paymentId);

    constructor(address _token) {
        token = IERC20(_token);
    }

    function createConditionalPayment(
        address beneficiary,
        address notary,
        uint256 amount,
        uint256 expiration
    ) external returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(notary != address(0), "Invalid notary");
        require(amount > 0, "Amount must be positive");
        require(expiration > block.timestamp, "Invalid expiration");

        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        paymentCounter++;
        uint256 paymentId = paymentCounter;

        payments[paymentId] = Payment({
            payer: msg.sender,
            beneficiary: beneficiary,
            notary: notary,
            amount: amount,
            expiration: expiration,
            status: Status.PENDING
        });

        emit ConditionalPaymentCreated(
            paymentId,
            msg.sender,
            beneficiary,
            notary,
            amount,
            expiration
        );
        return paymentId;
    }

    // possiblity to add a hashlock verison

    function executePayment(uint256 paymentId) external {
        Payment storage payment = payments[paymentId];
        require(
            payment.status == Status.PENDING,
            "Already executed or cancelled"
        );
        require(block.timestamp <= payment.expiration, "Payment expired");
        require(msg.sender == payment.notary, "Only notary can execute");

        payment.status = Status.EXECUTED;
        require(
            token.transfer(payment.beneficiary, payment.amount),
            "Transfer failed"
        );

        emit PaymentExecuted(paymentId);
    }

    function cancelExpiredPayment(uint256 paymentId) external {
        Payment storage payment = payments[paymentId];
        require(
            payment.status == Status.PENDING,
            "Already executed or cancelled"
        );
        require(block.timestamp > payment.expiration, "Not expired yet");

        payment.status = Status.CANCELLED;
        require(token.transfer(payment.payer, payment.amount), "Refund failed");

        emit PaymentCancelled(paymentId);
    }
}
