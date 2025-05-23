import { promises as pfs } from 'fs';
import xml2js from 'xml2js';
import { ethers } from 'ethers';
import fs from 'fs';
import chalk from 'chalk'
import * as desp from './DESP/interact.js'
// initialize DESP module for API interactions
desp.init();


import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
// Koa framework imports
import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import serveStatic from 'koa-static'
import cors from '@koa/cors'

export function serve() {
    const app = new Koa()
    app.use(cors())
    app.use(bodyParser())
    const router = new Router()

    app.use(serveStatic('../frontend/'))
    console.log(chalk.green('Webpage served http://127.0.0.1:3000/'))

    // set no-cache for quick dev refreshes
    app.use(async (ctx, next) => {
        ctx.set('Cache-Control', 'no-cache, no-store, must-revalidate')
        ctx.set('Pragma', 'no-cache')
        ctx.set('Expires', '0')
        await next()
    })

    router.get('/mockoffers', async ctx => {
        await mockOffers()
        ctx.body = 'Mock offers created'
    })
    router.get('/info', async ctx => {
        ctx.body = await desp.getInfo()
    })
    router.get('/holdings', async ctx => {
        ctx.body = await desp.getHoldings()
    })
    // router.get('/reserve', async ctx => {

    //     //get fromName, toName and amount from the query
    //     const fromName = ctx.query.fromName
    //     const toName = ctx.query.toName
    //     const amount = ctx.query.amount

    //     console.log(`creating reservation for ${fromName} to ${toName} for ${amount}`)
    //     const rsvID = await desp.createReservation(fromName, toName, amount)
    //     ctx.body = rsvID
    // })
    router.post('/reserve', async ctx => {
        try {
            const { fromName, toName, amount } = ctx.request.body;
            console.log(`API:Creating reservation for ${fromName} to ${toName} for € ${amount}`);
            const holdings = await desp.getHoldings();
            const fromId = Object.keys(holdings).find(k => holdings[k].name === fromName) || fromName;
            const ids = Object.keys(holdings);
            // const toId = ids[1] || ids[0];
            const toId = Object.keys(holdings).find(k => holdings[k].name === toName) || toName;

            const rsvID = await desp.createReservation(fromId, toId, amount);
            ctx.body = { rsvID };
        } catch (err) {
            console.error('Reserve error:', err);
            ctx.status = 500;
            ctx.body = { error: err.message };
        }
    })
    router.post('/pay', async ctx => {
        try {
            // retrieve offer
            const { offerId, rsvId, amount } = ctx.request.body;

            console.log(`API: Paying offer ${offerId} with reservation ${rsvId} for ${amount}`)
            const paymentId = await desp.createPayment(rsvId, amount);

            console.log(`payment ${paymentId} created`)
            let txHash = await triggerSmartContract(paymentId, offerId)
            console.log(`payment ${paymentId} triggered`)
            ctx.body = { paymentId, txHash };
            // await desp.getPayment(paymentId)
            // ctx.body = await desp.getPayment(paymentId)

        } catch (err) {
            console.error('Payment error:', err);
            ctx.status = 500;
            ctx.body = { error: err.message };
        }
    })
    app.use(router.routes()).use(router.allowedMethods())
    app.listen(3000, () => console.log(chalk.green('Server started on port 3000')))
}

// constants
const NAGAEX_ADDRESS = "0xA9E1a01Df3a691d00581297F37dE279120996BC3";
const USDC_ADDRESS = "0x14e195D27FFF5F4A1139CB7f6e0F5712F8d420B4";
const NAGAEX_ABI = [
    "function makeOffer(uint amount) public",
    "function signalIntend(uint offerID) public",
    "function offers(uint) public view returns (uint amount, address seller, uint lockUntil, address bider)",
    "function offerCounter() public view returns (uint)",
    "function unlockFunds (uint offerID) public",
    "event OfferMade(uint offerID, uint amount, address user)",
    "event OfferLocked(uint offerID, address user)"
];

const USDC_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const screeningURL = 'https://api.circle.com/v1/w3s/compliance/screening/addresses';

function isPaymentMatching(payment, offer, offerID) {
    const infos = payment.Document.FIToFICstmrCdtTrf[0].CdtTrfTxInf[0];
    const isValidAmount = parseFloat(infos.IntrBkSttlmAmt[0]['_']) === parseFloat(offer.amount)
    // Multi currency to be added in the smart contract offer (assuming USD for now)
    // const isValidCurrency = infos.IntrBkSttlmAmt[0]['$'].Ccy === offer.currency
    const isValidIBAN = infos.CdtrAcct[0].Id[0].IBAN[0] === offer.IBAN;
    const isValidOfferID = infos.RmtInf[0].Ustrd[0] == offerID;
    console.log("Checks: ", isValidAmount, isValidOfferID, isValidIBAN)

    return isValidAmount && isValidOfferID && isValidIBAN;
}

async function extractPaymentInfo(fileName) {
    try {
        const data = await pfs.readFile('./Data/' + fileName)
        const paymentInfo = await xml2js.parseStringPromise(data)
        return paymentInfo
    } catch (err) {
        console.error('Error:', err)
    }
}

async function triggerSmartContract(paymentInfo, offerID) {
    const provider = new ethers.getDefaultProvider("http://localhost:8545/");

    const contractAddress = NAGAEX_ADDRESS
    const contractABI = NAGAEX_ABI
    const wallet = ethers.Wallet.fromPhrase(process.env.SEED, provider);

    const contract = new ethers.Contract(contractAddress, contractABI, wallet);
    try {
        const tx = await contract.unlockFunds(offerID, {
            gasLimit: 2000000
        });
        const receipt = await tx.wait();
        // console.log('Transaction receipt:', receipt);
        console.log("Update successfull. Tx hash:", receipt.hash)
        return receipt.hash
    } catch (err) {
        console.error('Error triggering smart contract:', err);
    }
}

function screeningParameters(addressToScreen) {
    // node fetch options for screening
    return {
        method: 'post',
        headers: {
            Authorization: `Bearer ${process.env.CIRCLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: addressToScreen, chain: 'MATIC-AMOY', idempotencyKey: 'f46ecf25-d8fa-45f7-9c72-502d3d8268a0' })
    }
}

function displayUsers() {
    const users = JSON.parse(fs.readFileSync('../frontend/user-ids.json', 'utf8'));
    console.log('Users:');
    users.forEach(user => console.log(`${user.name} \n ${user.dEid} ${user.address} ${user.IBAN}`));
}
// Akave

// const API_BASE_URL = 'http://localhost:8000';

// async function apiRequest(method, endpoint, data = null) {
//     try {
//         const response = await axios({
//             method,
//             url: `${API_BASE_URL}${endpoint}`,
//             data,
//         });
//         console.log(response.data);
//     } catch (error) {
//         console.error(error.response ? error.response.data : error.message);
//     }
// }

// async function uploadFile(bucketName, filePath) {
//     const form = new FormData();
//     form.append('file', fs.createReadStream(filePath));

//     try {
//         const response = await axios.post(`${API_BASE_URL}/buckets/${bucketName}/files`, form, {
//             headers: form.getHeaders(),
//         });
//         console.log(response.data);
//     } catch (error) {
//         console.error(error.response ? error.response.data : error.message);
//     }
// }

// EXECUTION

async function execution(offerID) {
    // Getting SWIFT data
    let skipPaymentInfo = true // true  to skip payment info analysis steps


    // Getting offer data
    const provider = new ethers.getDefaultProvider("http://localhost:8545/");
    const contract = new ethers.Contract(NAGAEX_ADDRESS, NAGAEX_ABI, provider);
    const offer = await contract.offers(offerID);
    if (!offer || offer.seller === ethers.ZeroAddress) {
        throw new Error(`Offer ${offerID} does not exist or has been voided`);
    }

    if (!skipPaymentInfo) {
        const paymentInfo = await extractPaymentInfo("payment" + offerID + ".xml");
        if (!paymentInfo) {
            throw new Error('Failed to extract payment information');
        } else {
            console.log('📂 Payment info extracted successfully');
        }
        if (!isPaymentMatching(paymentInfo, offer, offerID)) {
            throw new Error('Invalid payment information');
        } else {
            console.log('🥳 Payment is valid');
        }
    }

    // 1. Compliance screening: Before sending the funds, we check the buyer's address. A similar check could be made during the offer.
    try {
        const response = await fetch(screeningURL, screeningParameters(offer.bider));
        const json = await response.json();
        console.log(json);
        if (json.data.result === 'APPROVED') {
            // 2. Execute contract 
            // triggerSmartContract(paymentInfo, offerID);

            const wallet = ethers.Wallet.fromPhrase(process.env.SEED, provider);
            const contractWithSigner = new ethers.Contract(NAGAEX_ADDRESS, NAGAEX_ABI, wallet);
            console.log('🔒 Signaling intent');
            const tx2 = await contractWithSigner.signalIntend(offerID);
            await tx2.wait();
            console.log('🔓 Unlocking funds');
            const tx3 = await contractWithSigner.unlockFunds(offerID, { gasLimit: 2000000 });
            const receipt = await tx3.wait();
            console.log("Update successful. Tx hash:", receipt.hash);
        } else {
            console.error('Compliance screening not approved');
        }
    } catch (err) {
        console.error('Error during compliance or contract execution:', err);
    }

    // 3. Upload payment file
    // await apiRequest('POST', '/buckets', { bucketName: 'nagabanking' });
    // await uploadFile('nagabanking', './Data/payment2.xml');

}

async function createOffer(offer, contractSigner) {
    const tx = await contractSigner.makeOffer(offer.amount);
    await tx.wait();
    console.log(`📄 Offer created: ${offer.amount} for ${offer.seller}`);
}

async function pathGuesser() {
    // used during developement to find the correct method to retrieve metamask/rabby derived wallet.
    displayUsers()
    const aliceWallet = ethers.HDNodeWallet.fromPhrase(process.env.SEED)
    const path0 = "44'/60'/0'/0/0"
    const path1 = "44'/60'/0'/0/1"
    const path2 = "44'/60'/0'/1/0"
    const path3 = "44'/60'/1'/0/0"


    console.log("Alice \t\t", aliceWallet.address);
    const mnemonic = aliceWallet.mnemonic

    console.log("mnemo", mnemonic)
    console.log("From Mnemo path0", ethers.HDNodeWallet.fromMnemonic(mnemonic, path0).address)
    console.log("From Mnemo path1", ethers.HDNodeWallet.fromMnemonic(mnemonic, path1).address) // Victory!
    console.log("From Mnemo path2", ethers.HDNodeWallet.fromMnemonic(mnemonic, path2).address)
    console.log("From Mnemo path3", ethers.HDNodeWallet.fromMnemonic(mnemonic, path3).address)

    console.log("Derived child\t", aliceWallet.deriveChild(0).address)
    console.log("Derived child\t", aliceWallet.deriveChild(1).address)
    console.log("Derived child\t", aliceWallet.deriveChild(2).address)
    console.log("Derived child\t", aliceWallet.deriveChild(3).address)

    console.log("Derived path '0'", aliceWallet.derivePath("0").address)

    console.log("Derived path0\t", aliceWallet.derivePath(path0).address)
    console.log("Derived path1\t", aliceWallet.derivePath(path1).address)
    console.log("Derived path2\t", aliceWallet.derivePath(path2).address)
    console.log("Derived path3\t", aliceWallet.derivePath(path3).address)

    const pathM0 = `m/44'/60'/0'/0/0`
    const pathM1 = `m/44'/60'/0'/0/1`

    console.log("From seed with PathM0", ethers.HDNodeWallet.fromPhrase(process.env.SEED, pathM0).address)
    console.log("From seed with PathM1", ethers.HDNodeWallet.fromPhrase(process.env.SEED, pathM1).address)

    console.log("From seed with Path0", ethers.HDNodeWallet.fromPhrase(process.env.SEED, path0).address)
    console.log("From seed with Path1", ethers.HDNodeWallet.fromPhrase(process.env.SEED, path1).address)
    console.log("From seed with Path2", ethers.HDNodeWallet.fromPhrase(process.env.SEED, path2).address)
}


async function mockOffers() {
    // const provider = new ethers.getDefaultProvider("http://localhost:8545/");
    const provider = new ethers.JsonRpcProvider("http://localhost:8545/");
    displayUsers()
    const aliceWallet = ethers.HDNodeWallet.fromPhrase(process.env.SEED).connect(provider);
    const mnemonic = aliceWallet.mnemonic

    const path1 = "44'/60'/0'/0/1"
    const path2 = "44'/60'/0'/0/2"
    const path3 = "44'/60'/0'/0/3"

    const bobWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, path1).connect(provider);
    const charlesWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, path2).connect(provider);
    const deniseWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, path3).connect(provider);
    console.log("Retrieved Charles", charlesWallet.address);
    console.log("Retrieved Denise", deniseWallet.address);

    const contractWithSignerCharles = new ethers.Contract(NAGAEX_ADDRESS, NAGAEX_ABI, charlesWallet);
    const contractWithSignerDenise = new ethers.Contract(NAGAEX_ADDRESS, NAGAEX_ABI, deniseWallet);
    createOffer({ amount: 50000000, seller: 'Denise' }, contractWithSignerDenise)
    await createOffer({ amount: 1900000, seller: 'Charles' }, contractWithSignerCharles) // we need to wait for one Charles transaction to avoid nonce errors
    createOffer({ amount: 25000000, seller: 'Charles' }, contractWithSignerCharles)
}

// Run the execution
// scenarioGenerateOffers().catch(console.error)
// execution(3).catch(console.error)

function usage() {
    console.log(chalk.green('\nUsage: node index.js <resource> <action> [options]'));
    console.log('Resources and actions:');
    console.log('  info');
    console.log('  mockoffers');
    console.log('  holdings list');
    console.log('  holdings create <type> <name>');
    console.log('  holdings get <nameOrId>');
    console.log('  reservations list [--createdFrom ISO] [--createdTo ISO] [--reservationStatus status] [--debtorEntry nameOrId] [--creditorEntry nameOrId]');
    console.log('  reservations create <fromName> <toName> <amount>');
    console.log('  reservations update <id> [<amount>] [<expiryHours>]');
    console.log('  reservations get <id>');
    console.log('  payments create <reservationId> <amount>');
    console.log('  payments get <paymentId>');
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        usage();
        console.log(chalk.blue('\nUsing default: Serve'))
        serve();
        // process.exit(0);
    }
    const [resource, action, ...rest] = args;
    switch (resource) {
        case 'serve':
            let info2 = await desp.getInfo()
            desp.displayResults(info2);
            serve();
            break;
        case 'mockoffers':
            await mockOffers();
            break;
        case 'info':
            let info = await desp.getInfo()
            desp.displayResults(info);
            break;
        case 'holdings':
            if (action === 'list') {
                desp.displayHoldings(await desp.getHoldings());
            } else if (action === 'create') {
                const [type, name] = rest;
                await desp.createHolding(type, name);
            } else if (action === 'get') {
                const [nameOrId] = rest;
                await desp.getHolding(nameOrId);
            } else {
                usage();
            }
            break;
        case 'reservations':
            if (action === 'list') {
                const params = {};
                for (let i = 0; i < rest.length; i += 2) {
                    const key = rest[i].replace('--', '');
                    let val = rest[i + 1];
                    if (key === 'debtorEntry' || key === 'creditorEntry') val = KNOWN_IDS[val] || val;
                    params[key] = val;
                }
                await desp.listReservations(params);
            } else if (action === 'create') {
                const [fromName, toName, amt] = rest;
                await desp.createReservation(fromName, toName, Number(amt));
            } else if (action === 'update') {
                const [id, amt, hours] = rest;
                await desp.updateReservation(id, amt !== undefined ? Number(amt) : undefined, hours !== undefined ? Number(hours) : undefined);
            } else if (action === 'get') {
                const [id] = rest;
                await desp.getReservationById(id);
            } else {
                usage();
            }
            break;
        case 'payments':
            if (action === 'create') {
                const [rsvId, amt] = rest;
                await desp.createPayment(rsvId, Number(amt));
            } else if (action === 'get') {
                const [paymentId] = rest;
                await desp.getPayment(paymentId);
            } else {
                usage();
            }
            break;
        default:
            usage();
    }
}

main();