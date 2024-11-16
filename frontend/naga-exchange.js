import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.min.js";

const LOCALRUN = true;
// Contract configuration

const NAGAEX_ADDRESS = "0xA9E1a01Df3a691d00581297F37dE279120996BC3";
const USDC_ADDRESS = "0x14e195D27FFF5F4A1139CB7f6e0F5712F8d420B4";

const NAGAEX_ABI = [
    "function makeOffer(uint amount, string memory IBAN) public",
    "function signalIntend(uint offerID) public",
    "function offers(uint) public view returns (uint amount, string IBAN, address seller, uint lockUntil, address bider)",
    "function offerCounter() public view returns (uint)",
    "event OfferMade(uint offerID, uint amount, string IBAN, address user)",
    "event OfferLocked(uint offerID, address user)"
];

const USDC_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

// Kinto KYC Viewer contract configuration
const KYCviewer_ADDRESS = "0x33F28C3a636B38683a38987100723f2e2d3d038e"
const KYCviewer_ABI = [
    "function isKYC(address _address) external view returns(bool)",
    "function isSanctionsSafe(address _account) external view returns(bool)",
    "function isSanctionsSafeIn(address _account, uint16 _countryId) external view returns(bool)",
    "function isCompany(address _account) external view returns(bool)",
    "function isIndividual(address _account) external view returns(bool)",
    "function hasTrait(address _account, uint16 _traitId) external view returns(bool)",
    "function hasTraits(address account, uint16[] memory _traitIds) public view returns(bool[] memory)",
    "function getCountry(address account) external view returns(uint16)",
    "function getWalletOwners(address _wallet) public view returns(address[] memory owners)",
    "function getUserInfo(address _account, address payable _wallet) external view returns(IKYCViewer.UserInfo memory info)",
    "function getDevApps(address _wallet) external view returns(IKintoAppRegistry.Metadata[] memory)",
    "function getBalances(address[] memory tokens, address target) external view returns(uint256[] memory balances)"
]

let provider, signer, usdContract, nagaexContract, kycContract, chainId;
let currentPage = 'browse';

// Initialize Web3
async function initWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            chainId = await window.ethereum.request({ method: 'eth_chainId' });
            console.log(chainId)

            // Ensure MetaMask is connected to localhost (chainId 0x539 for Ganache, 0x7a69 for Hardhat) during development
            // if (chainId !== '0x539' && chainId !== '0x7a69') {
            //     notification('Please connect MetaMask to localhost');
            //     updateWalletStatus('Wrong network');
            //     return;
            // }

            provider = new ethers.BrowserProvider(window.ethereum);
            if (chainId == 0x1ecf) {
                console.log("We are on Kinto")
                const kprovider = new ethers.getDefaultProvider("https://rpc.kinto-rpc.com/");
                kycContract = new ethers.Contract(KYCviewer_ADDRESS, KYCviewer_ABI, kprovider);
            }
            signer = await provider.getSigner();
            nagaexContract = new ethers.Contract(NAGAEX_ADDRESS, NAGAEX_ABI, signer);
            usdContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

            updateWalletStatus('✅ Connected: ' + (await signer.getAddress()).slice(0, 6) + '...');
            setupEventListeners();
        } catch (error) {
            console.error('Error initializing Web3:', error);
            updateWalletStatus('Connection failed');
        }
    } else {
        updateWalletStatus('Please install MetaMask');
    }
}

// Update wallet status display
function updateWalletStatus(status) {
    document.getElementById('wallet-status').textContent = status;
}
// Display notification

async function notification(message) {
    const notificationElement = document.getElementById('notification');
    notificationElement.textContent = message;
    notificationElement.classList.add('visible');

    // Hide after 2 seconds
    setTimeout(() => {
        notificationElement.classList.remove('visible');
    }, 2000);
}

// Load and display offers
async function loadOffers() {
    try {
        const offerCount = await nagaexContract.offerCounter();
        const offersList = document.getElementById('offers-list');
        offersList.innerHTML = '';

        for (let i = 1; i <= offerCount; i++) {
            const offer = await nagaexContract.offers(i);
            if (offer.seller !== ethers.ZeroAddress) {

                let kyc, country;
                if (chainId == 0x1ecf) {
                    console.log("We are on Kinto")
                    console.log("SELLER", offer.seller)

                    const seller = "0x139E312fCD4c35302a8d80a404d54a145A3a1c19" //offer.seller;
                    let isSellerKYCed = await kycContract.isKYC(seller);
                    console.log(isSellerKYCed)
                    kyc = isSellerKYCed ? "✅ KYC Verified" : "⚠️ No KYC"
                    let countryCode = await kycContract.getCountry(seller);
                    country = countryCode == 250 ? "🇫🇷" : "";
                    console.log(countryCode)
                } else {
                    kyc = "⚠️ No KYC";
                    country = "";
                }

                const offerElement = createOfferElement(i, offer, kyc, country);
                offersList.appendChild(offerElement);
            }
        }
    } catch (error) {
        console.error('Error loading offers:', error);
    }
}

// Create offer element
function createOfferElement(id, offer, kyc, country) {
    const div = document.createElement('div');
    div.className = 'offer-card';

    const isLocked = offer.lockUntil > Date.now() / 1000;
    const status = isLocked ? '🔒️ Locked' : 'Available';

    div.innerHTML = `
        <div class="offer-status">${status}</div>
        <h4>Offer #${id}</h4>
        <p>Amount: ${ethers.formatUnits(offer.amount, 6)} USDC</p>
        <p>IBAN:    ${offer.IBAN}</p>
        <p>Seller:  ${offer.seller.slice(0, 12)}...      ${kyc}      ${country}</p>
        ${!isLocked ? `<button onclick="signalIntend(${id})" class="button button-outline">Signal Intent</button>` : ''}
    `;
    return div;
}

// Signal intent for an offer
async function signalIntend(offerId) {
    try {
        const tx = await nagaexContract.signalIntend(offerId);
        await tx.wait();
        await loadOffers();
    } catch (error) {
        console.error('Error signaling intent:', error);
        notification('Failed to signal intent');
    }
}

// Create new offer
async function createOffer(event) {
    event.preventDefault();
    const amount = document.getElementById('amount').value;
    const iban = document.getElementById('iban').value;
    const address = document.getElementById('address').value;

    const amountInWei = ethers.parseUnits(amount, 6); // 6 decimals for USDC
    console.log("AMOUNT IN WEI", amountInWei)

    // try {
    //     const tx = await usdContract.approve(NAGAEX_ADDRESS, amountInWei);
    //     await tx.wait();
    //     const txHash = tx.hash;
    //     const blockscoutLink = `https://blockscout.com/tx/${txHash}`;
    //     notification(`Authorized spending successfully! View transaction: ${blockscoutLink}`)
    //     event.target.reset();
    //     showPage('browse');
    // } catch (error) {
    //     console.error('Error authorizing speding', error);
    //     notification('Failed to authorize spending');
    // }



    try {
        // TODO : take into account the address in case it is not the user address. 
        const tx = await nagaexContract.makeOffer(amountInWei, iban);
        await tx.wait();
        const txHash = tx.hash;
        const blockscoutLink = `https://blockscout.com/tx/${txHash}`;
        notification(`Offer created successfully! View transaction: ${blockscoutLink}`)
        event.target.reset();
        showPage('browse');
    } catch (error) {
        console.error('Error creating offer:', error);
        notification('Failed to create offer');
    }
}

// Show/hide pages
function showPage(page) {
    document.getElementById('browse-page').classList.toggle('hidden', page !== 'browse');
    document.getElementById('create-page').classList.toggle('hidden', page !== 'create');

    document.querySelector('[onclick="showPage(\'browse\')"]')
        .classList.toggle('button-outline', page !== 'browse');
    document.querySelector('[onclick="showPage(\'create\')"]')
        .classList.toggle('button-outline', page !== 'create');

    if (page === 'browse') loadOffers();
    currentPage = page;
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('create-offer-form').addEventListener('submit', createOffer);

    // Listen for contract events
    nagaexContract.on('OfferMade', (offerId, amount, iban, user) => {

        if (currentPage === 'browse') loadOffers();
    });

    nagaexContract.on('OfferLocked', (offerId, user) => {
        if (currentPage === 'browse') loadOffers();
    });
}

// Make functions globally available
window.showPage = showPage;
window.signalIntend = signalIntend;

// Initialize on page load
document.addEventListener('DOMContentLoaded', initWeb3); 