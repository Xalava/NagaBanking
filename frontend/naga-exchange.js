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
let isKinto = false;
let loadOffersRunning = false;

// Initialize Web3
async function initWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            chainId = await window.ethereum.request({ method: 'eth_chainId' });
            console.log({ chainId })

            // Ensure MetaMask is connected to localhost (chainId 0x539 for Ganache, 0x7a69 for Hardhat) during development
            if (chainId !== '0x539' && chainId !== '0x7a69') {
                notification('Please connect MetaMask to localhost', 'info');
                // updateWalletStatus('Wrong network');
                // return;
            }

            provider = new ethers.BrowserProvider(window.ethereum);
            if (chainId == 0x1ecf) {
                console.log("We are on Kinto")
                isKinto = true
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
    notification(status, 'info')
}
// Display notification

async function notification(message, type = 'info') {
    const notificationElement = document.getElementById('notification');

    // Remove existing visible class if any
    notificationElement.classList.remove('visible');

    // Force a reflow to restart animation
    void notificationElement.offsetWidth;

    notificationElement.innerHTML = message;
    notificationElement.classList.add(type);
    notificationElement.classList.add('visible');

    setTimeout(() => {
        notificationElement.classList.remove('visible');
    }, 5000);
}

// Load and display offers
async function loadOffers() {
    if (loadOffersRunning) return;
    loadOffersRunning = true;
    if (!nagaexContract) {
        console.error('Contract not initialized');
        notification('Contract not initialized. Please connect your wallet.', 'error');
        loadOffersRunning = false;
        return;
    }
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
                    // Put the approrpiate flag depending on the first two letters of the iban
                    const countryCode = offer.IBAN.substring(0, 2).toUpperCase();
                    country = {
                        AE: " 🇦🇪 ", AL: " 🇦🇱 ", AD: " 🇦🇩 ", AT: " 🇦🇹 ", BY: " 🇧🇾 ", BE: " 🇧🇪 ", BA: " 🇧🇦 ", BG: " 🇧🇬 ", BH: " 🇧🇭 ", BR: " 🇧🇷 ", BN: " 🇧🇳 ", CA: " 🇨🇦 ", CH: " 🇨🇭 ", CN: " 🇨🇳 ", CY: " 🇨🇾 ", CZ: " 🇨🇿 ", DE: " 🇩🇪 ", DK: " 🇩🇰 ", DO: " 🇩🇴 ", EE: " 🇪🇪 ", EG: " 🇪🇬 ", ES: " 🇪🇸 ", FI: " 🇫🇮 ", FR: " 🇫🇷 ", GB: " 🇬🇧 ", GE: " 🇬🇪 ", GI: " 🇬🇮 ", GR: " 🇬🇷 ", HR: " 🇭🇷 ", HU: " 🇭🇺 ", IE: " 🇮🇪 ", IL: " 🇮🇱 ", IN: " 🇮🇳 ", IS: " 🇮🇸 ", IT: " 🇮🇹 ", JO: " 🇯🇴 ", JP: " 🇯🇵 ", KW: " 🇰🇼 ", KZ: " 🇰🇿 ", LB: " 🇱🇧 ", LI: " 🇱🇮 ", LT: " 🇱🇹 ", LU: " 🇱🇺 ", LV: " 🇱🇻 ", LY: " 🇱🇾 ", MA: " 🇲🇦 ", MC: " 🇲🇨 ", MD: " 🇲🇩 ", ME: " 🇲🇪 ", MG: " 🇲🇬 ", MK: " 🇲🇰 ", MT: " 🇲🇹 ", MX: " 🇲🇽 ", MY: " 🇲🇾 ", NL: " 🇳🇱 ", NO: " 🇳🇴 ", NZ: " 🇳🇿 ", OM: " 🇴🇲 ", PK: " 🇵🇰 ", PL: " 🇵🇱 ", PT: " 🇵🇹 ", QA: " 🇶🇦 ", RO: " 🇷🇴 ", RS: " 🇷🇸 ", RU: " 🇷🇺 ", SA: " 🇸🇦 ", SE: " 🇸🇪 ", SG: " 🇸🇬 ", SI: " 🇸🇮 ", SK: " 🇸🇰 ", SM: " 🇸🇲 ", TN: " 🇹🇳 ", TR: " 🇹🇷 ", UA: " 🇺🇦 ", US: " 🇺🇸 ",
                    }[countryCode] || "";

                    if (offer.IBAN == "FR123") {
                        kyc = "  ✅ KYC Verified"
                    } else if (offer.IBAN == "US123") {
                        kyc = "  ✅ KYC Verified"
                    } else {
                        kyc = "⚠️ No KYC";
                    }
                }

                const offerElement = createOfferElement(i, offer, kyc, country);
                offersList.appendChild(offerElement);
            }
        }
    } catch (error) {
        console.error('Error loading offers:', error);
    } finally {
        loadOffersRunning = false;
    }
}


// load payments
async function loadPayments() {
    // call the server on port 3000 to get holdings /holdings
    try {
        // fetch holdings from same origin to avoid CORS
        const response = await fetch('/holdings');
        const holdings = await response.json();
        const tableElement = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        const headers = ['Name', 'Type', 'Available', 'Reserved', 'ID'];
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        Object.keys(holdings)
            // sort alphabetically by name
            .sort((a, b) => holdings[a].name.localeCompare(holdings[b].name))
            .forEach(id => {
                const h = holdings[id];
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${h.name}</td>
                    <td style="color: ${h.type === "endUser" ? 'green' : 'orange'}">${h.type}</td>
                    <td>${h.available}</td>
                    <td>${h.amount - h.available ? `<span style="color: red; font-weight: bold">${h.amount - h.available}</span>` : 0}</td>
                    <td style="color: gray">${h.id}</td>
                `;
                tbody.appendChild(row);
            });

        tableElement.appendChild(thead);
        tableElement.appendChild(tbody);
        const oldTable = document.getElementById('holdings').querySelector('table');
        if (oldTable) {
            oldTable.remove();
        }
        document.getElementById('holdings').appendChild(tableElement);

    } catch (error) {
        console.error('Error loading holdings:', error);
    }
}

// Create offer element
function createOfferElement(id, offer, kyc, country) {
    const div = document.createElement('div');
    div.className = 'offer-card';

    const isLocked = offer.lockUntil > Date.now() / 1000;
    const status = isLocked ? '🔒️ Locked' : '🟢 Available';

    div.innerHTML = `
    <h4>Offer #${id}</h4>
    <div class="row">
        <div class="column column-75">
            <p>Amount: ${ethers.formatUnits(offer.amount, 6)}0 USDC</p>
            <p>IBAN:    ${offer.IBAN}   (${country})</p>
            <p>Seller:  ${offer.seller.slice(0, 12)}...  &emsp; ${kyc} </p>
        </div>
        <div class="column centered">
            <p>
                <span class="offer-status">${status}</span >
            </p>
            <br><br>
            ${!isLocked ? `<button onclick="signalIntend(${id})" class="button button-outline" style="bottom:1rem">Signal Intent</button>
                <button onclick="reservationInterface(${id})" class="button button-outline" style="bottom:1rem">D€ Reservation</button>
                
            ` : ''}
            
        </div>
    </div>

    `;
    return div;
}

// Signal intent for an offer
async function signalIntend(offerId) {
    try {
        const tx = await nagaexContract.signalIntend(offerId);
        await tx.wait();
        await loadOffers();
        return true
    } catch (error) {
        console.error('Error signaling intent:', error);
        notification('Failed to signal intent', 'error');
        return false
    }
}

// Make reservation for an offer
let rsvId = ''; // Memory storage for subsequent calls

async function reservationInterface(offerId) {
    try {
        const dialogHtml = `
            <form method="dialog" style="text-align: right"><button id="close-btn" title="Close" type="button">✕</button></form>
            <h2>D€ Reservation</h2>
            <p> Use the D€ to reserve and pay for the offer</p>
            <p>Enter your name:</p>
            <input type="text" id="user-name" />
            <div>
                <button id="reserve-btn" type="button" class="button">Make Reservation (d€)<span id="rsv-btn-status"></span></button>
                <button id="intend-btn" type="button" class="button" disabled>Signal Intent (onchain)<span id="intend-btn-status"></span></button>
            </div>
            <button id="finalize-btn" type="button" class="button" disabled>
                Finalize transaction (d€ & onchain)
                <span id="finalize-btn-status"></span>
            </button>
        `
        let fromName = ''
        let toName = 'Charles'// should come from the offer, but we simplify for the moment
        const dialog = createDialog(dialogHtml);
        // Close dialog when clicking the ✕ icon
        dialog.querySelector('#close-btn').addEventListener('click', () => dialog.close());

        // Cache buttons & status spans
        const [reserveBtn, intendBtn, finalizeBtn] = ['#reserve-btn', '#intend-btn', '#finalize-btn'].map(id => dialog.querySelector(id));
        const [rsvStatus, intendStatus, finalizeStatus] = ['#rsv-btn-status', '#intend-btn-status', '#finalize-btn-status'].map(id => dialog.querySelector(id));
        const userNameForm = dialog.querySelector('#user-name');
        reserveBtn
            .addEventListener('click', async () => {
                rsvStatus.innerHTML = '<span class="spinner"></span>'
                try {
                    const userName = userNameForm.value;
                    fromName = userName || "Alice";
                    toName = "Charles";
                    rsvId = await makeReservation(fromName, toName, offerId);
                    if (rsvId) {
                        notification(`Reservation from ${fromName} to ${toName}: ${rsvId}`, 'success');
                        rsvStatus.innerHTML = ' ✅';
                        reserveBtn.disabled = true;
                        intendBtn.disabled = false;
                    }
                } catch (err) {
                    console.error('Reservation error:', err);
                    notification(`Reservation failed: ${err.message}`, 'error');
                }
            });
        intendBtn
            .addEventListener('click', async () => {
                intendStatus.innerHTML = '<span class="spinner"></span>'
                try {
                    let result = await signalIntend(offerId);
                    if (result) {

                        notification(`Intent signaled onchain. Offer n°${offerId} locked`, 'success');
                        intendStatus.innerHTML = ' ✅';
                        intendBtn.disabled = true;
                        finalizeBtn.disabled = false;
                    }
                } catch (err) {
                    console.error('Signal intent error:', err);
                    notification(`Signal intent failed: ${err.message}`, 'error');
                }
            });
        finalizeBtn
            .addEventListener('click', async () => {
                finalizeStatus.innerHTML = '<span class="spinner"></span>'
                try {
                    const result = await finalize(offerId, rsvId);
                    const { paymentId, txHash } = result;
                    finalizeStatus.innerHTML = '✅✅';
                    finalizeBtn.disabled = true;
                    const link = `https://blockscout.com/tx/${txHash}`;

                    notification(`D€ paiement from reservation done (id: ${paymentId}) and settled onchain (tx: <a link="${link}"> ${txHash.slice(0, 10)}...</a>)`, 'success');

                    // notification(`Offer n°${offerId} finalised`, 'success');
                    setTimeout(() => {
                        dialog.close()
                        loadOffers()

                    }, 500);

                } catch (err) {
                    console.error('Finalize interface error:', err);
                }
            });

    } catch (error) {
        console.error('Error in reservation interface:', error);
        notification('Failed to make reservation', 'error');
    }
}

function createDialog(html) {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = html;
    document.body.appendChild(dialog);
    dialog.showModal();
    return dialog;
}



async function makeReservation(fromName, toName, offerId) {
    const offer = await nagaexContract.offers(offerId);
    const amount = ethers.formatUnits(offer.amount, 6)
    const payload = { fromName, toName, amount };
    try {
        const res = await fetch('/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `Status ${res.status}`);
        }
        const data = await res.json();
        if (!data.rsvID) {
            throw new Error("Could not get an reservation ID")
        }
        console.log('Reservation ID:', data.rsvID);
        return data.rsvID;
    } catch (err) {
        console.error('makeReservation error:', err);
        notification(`Reservation failed: ${err.message}`, 'error');
        throw err;
    }
}


async function finalize(offerId, rsvId) {
    console.log('finalize called with parameters', { offerId, rsvId });
    const offer = await nagaexContract.offers(offerId);
    const amount = ethers.formatUnits(offer.amount, 6)

    // Send keys matching server expectations: offerId, rsvId
    const payload = { offerId, rsvId, amount };
    try {
        const res = await fetch('/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `Status ${res.status}`);
        }
        console.log(res)
        const data = await res.json();
        console.log('Payment result:', data);
        return { paymentId: data.paymentId, txHash: data.txHash }
        // const tx = await nagaexContract.unlockFunds(offerId);
        // await tx.wait();
        // const link = `https://blockscout.com/tx/${data.txHash}`;
        // notification(`Unlocked funds successfully! View transaction: ${link}`, 'success');
    } catch (err) {
        console.error('finalize error:', err);
        notification(`Finalize failed: ${err.message}`);
    }
}


// Create new offer
async function createOffer(event) {
    event.preventDefault();
    const amount = document.getElementById('amount').value;
    const iban = document.getElementById('iban').value;
    const address = document.getElementById('address').value;

    const amountInWei = ethers.parseUnits(amount * 1000000, 6); // 6 decimals for USDC
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
        notification(`Offer created successfully! <a href=${blockscoutLink}> View transaction</a>`, 'success')
        event.target.reset();
        showPage('browse');
    } catch (error) {
        console.error('Error creating offer:', error);
        notification('Failed to create offer', 'error');
    }
}

// Back Office Functions
let currentOfferId = 1;

async function changeOffer(delta) {
    const newOfferId = currentOfferId + delta;
    if (newOfferId > 0) {
        currentOfferId = newOfferId;
        await loadBackOfficeData(currentOfferId);
    }
}

// Add this function to get current block
async function getBlockNumber() {
    try {
        const blockNumber = await provider.getBlockNumber();
        return blockNumber;
        // document.getElementById('block-number').textContent = blockNumber;
    } catch (error) {
        console.error('Error getting block number:', error);
        // document.getElementById('block-number').textContent = 'Error';
    }
}

// Update loadBackOfficeData to include block number update
async function loadBackOfficeData(offerId = currentOfferId) {
    try {
        const offer = await nagaexContract.offers(offerId);

        // Update the UI with offer details
        document.getElementById('offer-id').textContent = offerId;
        document.getElementById('offer-amount').textContent = `${ethers.formatUnits(offer.amount, 6)} EURS`;
        document.getElementById('offer-iban').textContent = offer.IBAN;
        document.getElementById('offer-seller').textContent = `${offer.seller.slice(0, 6)}...`;
        document.getElementById('offer-buyer').textContent = offer.bider === ethers.ZeroAddress ?
            'No buyer yet' :
            `${offer.bider.slice(0, 6)}...`;

        document.getElementById('offer-details-status').textContent = (() => {
            updateScreeningStatus('payment-status', 'pending');
            updateScreeningStatus('compliance-status', 'pending');
            updateScreeningStatus('contract-status', 'pending');

            if (offer.IBAN == "") {
                return '❌ Not Available';
            }
            if (offer.bider == ethers.ZeroAddress) {
                return '✅ Available';
            }
            if (offer.seller == ethers.ZeroAddress) {
                updateScreeningStatus('payment-status', 'success');
                updateScreeningStatus('compliance-status', 'success');
                updateScreeningStatus('contract-status', 'success');
                document.getElementById('process-button').disabled = true;

                return '💰 Sold'
            }

            if (offer.lockUntil > getBlockNumber()) {
                return '🔒️ Locked';
            }

            // final case : to be processed (should be coonditional on the presence of a swift message)
            document.getElementById('process-button').disabled = false;
            return '⚠️ Pending';

        })()

    } catch (error) {
        console.error('Error loading offer:', error);
        notification('Failed to load offer details', 'error');
    }
}

// Update screening status badges
function updateScreeningStatus(elementId, status) {
    const badge = document.getElementById(elementId);
    badge.className = 'status-badge ' + status;
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
}

// Process the entire offer
async function processOffer() {
    // Mock the processing steps
    updateScreeningStatus('compliance-status', 'pending');
    setTimeout(() => {
        updateScreeningStatus('payment-status', 'success');
        notification('Payment validated successfully', 'success');
        setTimeout(() => {
            updateScreeningStatus('compliance-status', 'success');
            notification('Compliance check passed', 'success');

            // Mock contract update
            setTimeout(() => {
                updateScreeningStatus('contract-status', 'success');
                notification('Contract updated successfully', 'success');
                document.getElementById('process-button').disabled = true;
            }, 2000);
        }, 2000);
    }, 2000);
}

// Update showPage function to include back office
function showPage(page) {
    document.getElementById('browse-page').classList.toggle('hidden', page !== 'browse');
    document.getElementById('create-page').classList.toggle('hidden', page !== 'create');
    document.getElementById('backoffice-page').classList.toggle('hidden', page !== 'backoffice');
    document.getElementById('payment-page').classList.toggle('hidden', page !== 'payment');

    // Update button states
    document.querySelector('[onclick="showPage(\'browse\')"]')
        .classList.toggle('button-outline', page !== 'browse');
    document.querySelector('[onclick="showPage(\'create\')"]')
        .classList.toggle('button-outline', page !== 'create');
    document.querySelector('[onclick="showPage(\'backoffice\')"]')
        .classList.toggle('button-outline', page !== 'backoffice');
    document.querySelector('[onclick="showPage(\'payment\')"]')
        .classList.toggle('button-outline', page !== 'payment');

    if (page === 'browse') loadOffers();
    if (page === 'backoffice') loadBackOfficeData();
    if (page === 'payment') loadPayments();
    currentPage = page;
}

// Update the main setup function
function setupEventListeners() {
    document.getElementById('create-offer-form').addEventListener('submit', createOffer);
    document.getElementById('process-button').addEventListener('click', processOffer);

    // Contract event listeners...
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
window.processOffer = processOffer;
window.changeOffer = changeOffer;
window.reservationInterface = reservationInterface;
window.finalize = finalize;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await initWeb3()
    await loadOffers()
    loadPayments() /// for speed
});