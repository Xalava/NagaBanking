import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { spawn } from 'child_process'

describe('Naga Banking Server API Tests', function () {
    let serverProcess
    const BASE_URL = 'http://localhost:3000'

    before(async function () {
        // Start the server in the background
        serverProcess = spawn('node', ['index.js', 'serve'], {
            cwd: '/home/si/code/nagaBanking/server',
            stdio: 'pipe'
        })

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000))
    })

    after(function () {
        if (serverProcess) {
            serverProcess.kill('SIGTERM')
            // Force kill if it doesn't respond to SIGTERM
            setTimeout(() => {
                if (!serverProcess.killed) {
                    serverProcess.kill('SIGKILL')
                }
            }, 1000)
        }
    })

    describe('DESP API Endpoints', function () {
        it('should get server info', async function () {
            const response = await fetch(`${BASE_URL}/info`)
            const data = await response.json()

            assert.strictEqual(response.status, 200)
            assert.ok(data)
            assert.ok(typeof data === 'object')
            assert.ok(data.serviceName === "desp-experimentation")
        })

        it('should get holdings', async function () {
            const response = await fetch(`${BASE_URL}/holdings`)
            const data = await response.json()

            assert.strictEqual(response.status, 200)
            assert.ok(data)
            assert.ok(typeof data === 'object')
        })

        it('should get one user with a registered name', async function () {
            const response = await fetch(`${BASE_URL}/holdings`)
            const data = await response.json()

            const userIds = Object.keys(data) // Assuming `data` contains user UUIDs as keys
            assert.ok(userIds.length > 0, 'No users found in data')
            const randomUserId = userIds[Math.floor(Math.random() * userIds.length)]
            assert.ok(randomUserId, 'Failed to select a random user')
            assert.ok(Object.keys(data[randomUserId]).includes('name'), 'The selected user does not contain a "name" key')

        })


    })

    describe('Payment Operations', function () {
        it('should handle DESP payment', async function () {
            const paymentData = {
                fromName: 'Alice',
                toName: 'Charles',
                amount: 1
            }

            const response = await fetch(`${BASE_URL}/payDeuro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentData)
            })

            if (response.status !== 200) {
                const serverResponse = await response.text()
                console.error(`Server responded with ${response.status}: ${serverResponse}`)
                assert.fail(`${serverResponse}`)
            }
            const result = await response.text()
            assert.ok(result.length === 36, 'Result is not a valid UUID')
        })


    })

    describe('Blockchain Integration', function () {
        before(async function () {
            // Launch the blockchain process
            this.blockchainProcess = spawn('npx', ['hardhat', 'node'], {
                cwd: '/home/si/code/nagaBanking/',
                stdio: 'pipe'
            })

            // Wait for blockchain to start
            await new Promise(resolve => setTimeout(resolve, 3000))
        })

        after(function () {
            if (this.blockchainProcess) {
                this.blockchainProcess.kill()
            }
        })

        it('should handle mock offers', async function () {
            const response = await fetch(`${BASE_URL}/mockoffers`)
            const result = await response.text()
            assert.strictEqual(response.status, 200)
            assert.strictEqual(result, 'Mock offers created')
        })
    })
})