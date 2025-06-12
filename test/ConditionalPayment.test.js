const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('ConditionalPayment Contract Tests', function () {
    let conditionalPayment
    let stablecoin
    let owner, alice, bob, notary

    // Deploy contracts before each test
    beforeEach(async function () {
        [owner, alice, bob, notary] = await ethers.getSigners()

        // Deploy Stablecoin first
        const Stablecoin = await ethers.getContractFactory('Stablecoin')
        stablecoin = await Stablecoin.deploy('Euro X', 'EURX')
        await stablecoin.waitForDeployment()

        // Deploy ConditionalPayment with stablecoin address
        const ConditionalPayment = await ethers.getContractFactory('ConditionalPayment')
        conditionalPayment = await ConditionalPayment.deploy(await stablecoin.getAddress())
        await conditionalPayment.waitForDeployment()

        // Mint tokens to alice for testing
        await stablecoin.mint(alice.address, ethers.parseUnits('1000', 6)) // 1000 tokens with 6 decimals

        // Alice approves ConditionalPayment contract to spend her tokens
        await stablecoin.connect(alice).approve(await conditionalPayment.getAddress(), ethers.parseUnits('1000', 6))
    })

    describe('Contract Deployment', function () {
        it('should deploy with correct token address and initial state', async function () {
            const tokenAddress = await conditionalPayment.token()
            const paymentCounter = await conditionalPayment.paymentCounter()

            expect(tokenAddress).to.equal(await stablecoin.getAddress())
            expect(paymentCounter).to.equal(0)
        })

        it('should create conditional payment and transfer tokens to contract', async function () {
            const amount = ethers.parseUnits('100', 6) // 100 tokens
            const expiration = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now

            // Check initial balances
            const aliceBalanceBefore = await stablecoin.balanceOf(alice.address)
            const contractBalanceBefore = await stablecoin.balanceOf(await conditionalPayment.getAddress())

            // Create conditional payment
            const tx = await conditionalPayment.connect(alice).createConditionalPayment(
                bob.address,
                notary.address,
                amount,
                expiration
            )

            // Check balances after
            const aliceBalanceAfter = await stablecoin.balanceOf(alice.address)
            const contractBalanceAfter = await stablecoin.balanceOf(await conditionalPayment.getAddress())

            // Verify tokens were transferred
            expect(aliceBalanceBefore - aliceBalanceAfter).to.equal(amount)
            expect(contractBalanceAfter - contractBalanceBefore).to.equal(amount)

            // Check payment counter increased
            const paymentCounter = await conditionalPayment.paymentCounter()
            expect(paymentCounter).to.equal(1)

            // Verify payment was stored correctly
            const payment = await conditionalPayment.payments(1)
            expect(payment.payer).to.equal(alice.address)
            expect(payment.beneficiary).to.equal(bob.address)
            expect(payment.notary).to.equal(notary.address)
            expect(payment.amount).to.equal(amount)
            expect(payment.status).to.equal(0) // PENDING

            // Check event was emitted
            await expect(tx)
                .to.emit(conditionalPayment, 'ConditionalPaymentCreated')
                .withArgs(1, alice.address, bob.address, notary.address, amount, expiration)
        })
    })
})