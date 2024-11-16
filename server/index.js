import { promises as fs } from 'fs';
import xml2js from 'xml2js';
import { ethers } from 'ethers';
// import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.8.1/ethers.min.js";

import dotenv from 'dotenv';
dotenv.config({ path: '/home/si/code/NagaBanking/.env' });


const NAGAEX_ADDRESS = "0xA9E1a01Df3a691d00581297F37dE279120996BC3";
const USDC_ADDRESS = "0x14e195D27FFF5F4A1139CB7f6e0F5712F8d420B4";
const NAGAEX_ABI = [
    "function makeOffer(uint amount, string memory IBAN) public",
    "function signalIntend(uint offerID) public",
    "function offers(uint) public view returns (uint amount, string IBAN, address seller, uint lockUntil, address bider)",
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


function isPaymentValid(payment, amount, currency, sender, offerID) {
    const infos = payment.Document.FIToFICstmrCdtTrf[0].CdtTrfTxInf[0];
    const isValidAmount = parseFloat(infos.IntrBkSttlmAmt[0]['_']) === parseFloat(amount)
    const isValidCurrency = infos.IntrBkSttlmAmt[0]['$'].Ccy === currency;
    const isValidSender = infos.Dbtr[0].Nm[0] === sender;
    const isValidOfferID = infos.RmtInf[0].Ustrd[0] === offerID;
    console.log(isValidAmount, isValidCurrency, isValidSender, isValidOfferID)

    return isValidAmount && isValidCurrency && isValidSender && isValidOfferID;
}


async function extractPaymentInfo() {
    try {
        const data = await fs.readFile('./Data/payment.xml')
        const paymentInfo = await xml2js.parseStringPromise(data)
        return paymentInfo
    } catch (err) {
        console.error('Error:', err)
    }
}

async function triggerSmartContract(paymentInfo) {
    // const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const provider = new ethers.getDefaultProvider("http://localhost:8545/");

    // const provider = new ethers.providers.InfuraProvider('mainnet', 'YOUR_INFURA_PROJECT_ID') // Replace with your Infura project ID

    const contractAddress = NAGAEX_ADDRESS
    const contractABI = NAGAEX_ABI
    // const wallet = new ethers.HDNodeWallet.fromMnemonic(process.env.SEED).connect(provider);
    const wallet = ethers.Wallet.fromPhrase(process.env.SEED, provider);
    // const wallet = Wallet.fromPhrase(mnemonic);

    const contract = new ethers.Contract(contractAddress, contractABI, wallet);
    try {
        const tx = await contract.unlockFunds(1, {
            gasLimit: 2000000
        });
        const receipt = await tx.wait();
        console.log('Transaction receipt:', receipt);
    } catch (err) {
        console.error('Error triggering smart contract:', err);
    }
}

// EXECUTION

async function execution() {
    const paymentInfo = await extractPaymentInfo()
    if (isPaymentValid(paymentInfo, '1000', 'USD', 'Alice', '1')) {
        console.log(' 🥳 Payment is valid');
        triggerSmartContract(paymentInfo)
    } else {
        console.error('Missing in payment information');
    }

}

execution()



