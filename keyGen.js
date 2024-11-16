const ethers = require("ethers");
const dotenv = require("dotenv");
dotenv.config();
const mnemonic = process.env.SEED
const mnemonicWallet = ethers.Wallet.fromPhrase(mnemonic);
console.log(mnemonicWallet.privateKey);



function getCountryFlag(countryCode) {
    const isoCode = countryCode.toString().padStart(2, '0');
    const codePoints = isoCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

console.log(getCountryFlag(250));