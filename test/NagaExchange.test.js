const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('NagaExchange Contract Tests', function () {
    let nagaExchange
    let stablecoin
    let owner, alice, bob

    beforeEach(async function () {
        [owner, alice, bob] = await ethers.getSigners()

        // Deploy Stablecoin first
        const Stablecoin = await ethers.getContractFactory('Stablecoin')
        stablecoin = await Stablecoin.deploy('Euro X', 'EURX')
        await stablecoin.waitForDeployment()

        // Deploy NagaExchange with stablecoin address
        const NagaExchange = await ethers.getContractFactory('NagaExchange')
        nagaExchange = await NagaExchange.deploy(await stablecoin.getAddress())
        await nagaExchange.waitForDeployment()

        // Mint tokens to alice and bob for testing
        await stablecoin.mint(alice.address, ethers.parseUnits('1000', 6))
        await stablecoin.mint(bob.address, ethers.parseUnits('1000', 6))

        // Approve NagaExchange to spend tokens
        await stablecoin.connect(alice).approve(await nagaExchange.getAddress(), ethers.parseUnits('1000', 6))
        await stablecoin.connect(bob).approve(await nagaExchange.getAddress(), ethers.parseUnits('1000', 6))
    })

    describe('Contract Deployment', function () {
        it('should deploy with correct stablecoin address and owner whitelist', async function () {
            const stableAddress = await nagaExchange.stable()
            const offerCounter = await nagaExchange.offerCounter()
            const isOwnerWhitelisted = await nagaExchange.whitelist(owner.address)

            expect(stableAddress).to.equal(await stablecoin.getAddress())
            expect(offerCounter).to.equal(0)
            expect(isOwnerWhitelisted).to.equal(true)
        })

        it('should create offer and transfer tokens to exchange contract', async function () {
            const amount = ethers.parseUnits('50', 6) // 50 tokens

            // Check initial balances
            const aliceBalanceBefore = await stablecoin.balanceOf(alice.address)
            const exchangeBalanceBefore = await stablecoin.balanceOf(await nagaExchange.getAddress())

            // Create offer
            const tx = await nagaExchange.connect(alice).makeOffer(amount)

            // Check balances after
            const aliceBalanceAfter = await stablecoin.balanceOf(alice.address)
            const exchangeBalanceAfter = await stablecoin.balanceOf(await nagaExchange.getAddress())

            // Verify tokens were transferred
            expect(aliceBalanceBefore - aliceBalanceAfter).to.equal(amount)
            expect(exchangeBalanceAfter - exchangeBalanceBefore).to.equal(amount)

            // Check offer counter increased
            const offerCounter = await nagaExchange.offerCounter()
            expect(offerCounter).to.equal(1)

            // Verify offer was stored correctly
            const offer = await nagaExchange.offers(1)
            expect(offer.amount).to.equal(amount)
            expect(offer.seller).to.equal(alice.address)
            expect(offer.lockUntil).to.equal(0)
            expect(offer.bider).to.equal(ethers.ZeroAddress)

            // Check event was emitted
            await expect(tx)
                .to.emit(nagaExchange, 'OfferMade')
                .withArgs(1, amount, alice.address)
        })
    })
})