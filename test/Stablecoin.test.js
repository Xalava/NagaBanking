const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('Stablecoin Contract Tests', function () {
    let stablecoin
    let owner, alice, bob

    beforeEach(async function () {
        [owner, alice, bob] = await ethers.getSigners()

        // Deploy Stablecoin
        const Stablecoin = await ethers.getContractFactory('Stablecoin')
        stablecoin = await Stablecoin.deploy('Euro X', 'EURX')
        await stablecoin.waitForDeployment()
    })

    describe('Contract Deployment', function () {
        it('should deploy with correct name, symbol and decimals', async function () {
            const name = await stablecoin.name()
            const symbol = await stablecoin.symbol()
            const decimals = await stablecoin.decimals()
            const totalSupply = await stablecoin.totalSupply()

            expect(name).to.equal('Euro X')
            expect(symbol).to.equal('EURX')
            expect(decimals).to.equal(6)
            expect(totalSupply).to.equal(0)
        })

        it('should mint tokens and handle ERC20 operations correctly', async function () {
            const mintAmount = ethers.parseUnits('1000', 6) // 1000 EURX

            // Initial balance should be 0
            let aliceBalance = await stablecoin.balanceOf(alice.address)
            expect(aliceBalance).to.equal(0)

            // Mint tokens to alice
            await stablecoin.mint(alice.address, mintAmount)

            // Check balance after minting
            aliceBalance = await stablecoin.balanceOf(alice.address)
            expect(aliceBalance).to.equal(mintAmount)

            // Check total supply increased
            const totalSupply = await stablecoin.totalSupply()
            expect(totalSupply).to.equal(mintAmount)

            // Test transfer functionality
            const transferAmount = ethers.parseUnits('100', 6) // 100 EURX
            await stablecoin.connect(alice).transfer(bob.address, transferAmount)

            // Check balances after transfer
            const aliceBalanceAfter = await stablecoin.balanceOf(alice.address)
            const bobBalance = await stablecoin.balanceOf(bob.address)

            expect(aliceBalanceAfter).to.equal(mintAmount - transferAmount)
            expect(bobBalance).to.equal(transferAmount)

            // Test burn functionality
            const burnAmount = ethers.parseUnits('50', 6) // 50 EURX
            await stablecoin.burn(alice.address, burnAmount)

            // Check balance and total supply after burn
            const aliceBalanceAfterBurn = await stablecoin.balanceOf(alice.address)
            const totalSupplyAfterBurn = await stablecoin.totalSupply()

            expect(aliceBalanceAfterBurn).to.equal(aliceBalanceAfter - burnAmount)
            expect(totalSupplyAfterBurn).to.equal(totalSupply - burnAmount)

            // Test approve and allowance
            const approveAmount = ethers.parseUnits('200', 6) // 200 EURX
            await stablecoin.connect(alice).approve(bob.address, approveAmount)

            const allowance = await stablecoin.allowance(alice.address, bob.address)
            expect(allowance).to.equal(approveAmount)
        })
    })
})