import { promises as pfs } from 'fs';
import xml2js from 'xml2js';
import { ethers } from 'ethers';
import axios from "axios";
import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch'

import dotenv from 'dotenv';
dotenv.config({ path: '/home/si/code/NagaBanking/.env' });

const NAGAEX_ADDRESS = "0xA9E1a01Df3a691d00581297F37dE279120996BC3";
const USDC_ADDRESS = "0x14e195D27FFF5F4A1139CB7f6e0F5712F8d420B4";
const NAGAEX_ABI = [
    "function makeOffer(uint amount, string memory IBAN) public",
    "function signalIntend(uint offerID) public",
    "function offers(uint) public view returns (uint amount, string memory IBAN, address seller, uint lockUntil, address bider)",
    "function offerCounter() public view returns (uint)",
    "function unlockFunds (uint offerID) public",
    "event OfferMade(uint offerID, uint amount, string IBAN, address user)",
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

// Akave

const API_BASE_URL = 'http://localhost:8000';

async function apiRequest(method, endpoint, data = null) {
    try {
        const response = await axios({
            method,
            url: `${API_BASE_URL}${endpoint}`,
            data,
        });
        console.log(response.data);
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
    }
}

async function uploadFile(bucketName, filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    try {
        const response = await axios.post(`${API_BASE_URL}/buckets/${bucketName}/files`, form, {
            headers: form.getHeaders(),
        });
        console.log(response.data);
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
    }
}

// EXECUTION

async function execution(offerID) {
    // Getting SWIFT data
    const paymentInfo = await extractPaymentInfo("payment" + offerID + ".xml");
    if (!paymentInfo) {
        throw new Error('Failed to extract payment information');
    } else {
        console.log('📂 Payment info extracted successfully');
    }

    // Getting offer data
    const provider = new ethers.getDefaultProvider("http://localhost:8545/");
    const contract = new ethers.Contract(NAGAEX_ADDRESS, NAGAEX_ABI, provider);
    // const offer = await contract.offers(offerID);
    // if (!offer || offer.seller === ethers.ZeroAddress) {
    //     throw new Error(`Offer ${offerID} does not exist or has been voided`);
    // }

    // Mock for testing
    let offer = { amount: 1000, IBAN: 'US123', seller: 'Bob', lockUntil: 10, bider: 'Alice' }

    console.log('Offer details:', {
        amount: offer.amount,
        IBAN: offer.IBAN,
        seller: offer.seller,
        lockUntil: offer.lockUntil,
        bider: offer.bider
    });

    if (true || isPaymentMatching(paymentInfo, offer, offerID)) {
        console.log('🥳 Payment is valid');

        // 1. Compliance screening: Before sending the funds, we check the buyer's address. A similar check could be made during the offer.
        fetch(screeningURL, screeningParameters(offer.bider))
            .then(res => res.json())
            .then(json => {
                console.log(json);
                if (json.data.result === 'APPROVED') {
                    // 2. Execute contract 
                    triggerSmartContract(paymentInfo, offerID);
                }
            })
            .catch(err => console.error('error:' + err));

        // 3. Upload payment file
        // await apiRequest('POST', '/buckets', { bucketName: 'nagabanking' });
        // await uploadFile('nagabanking', './Data/payment2.xml');
    } else {
        console.error('Invalid payment information');
    }
}

// Run the execution
execution(2).catch(console.error);



