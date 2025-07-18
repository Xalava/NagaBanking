import dotenv from 'dotenv'
import axios from 'axios'
import chalk from 'chalk'
import Table from 'cli-table3'
import fs from 'fs'
import path from 'path'

let api // local object to make the API calls
// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), 'DESP/.env') })
// File to store known IDs
const KNOWN_IDS_FILE = path.join(process.cwd(), 'DESP/ids.json')
let KNOWN_IDS = {}
export function init() {
    const USER = process.env.API_USER
    const PASSWORD = process.env.API_PASSWORD
    const BASEURL = process.env.API_BASEURL
    // load known IDs for name lookup
    loadKnownIDs()
    if (!USER || !PASSWORD || !BASEURL) {
        console.error(chalk.red('Error: API_(USER,PASSWORD,BASEURL) must be defined in .env file'))
        process.exit(1)
    }
    api = axios.create({
        baseURL: BASEURL,
        auth: {
            username: USER,
            password: PASSWORD
        },
        headers: { Accept: 'application/json' },
        timeout: 10_000,
    })
    // Error management
    api.interceptors.response.use(
        res => res.data,
        err => {
            const { response } = err;
            if (response) {
                console.error(chalk.red(
                    `[DESP] ${response.status} – ${response.statusText}`
                ));
                console.error(JSON.stringify(response.data, null, 2));
            } else {
                console.error(chalk.red(err.message));
            }
            throw err;
        }
    );
    console.log(
        chalk.cyanBright('[DESP] client initialised →'),
        chalk.gray(BASEURL)
    )
}

export function cleanup() {
    // Close any persistent connections to allow Node.js to exit
    if (api && api.defaults && api.defaults.httpsAgent) {
        api.defaults.httpsAgent.destroy()
    }
    if (api && api.defaults && api.defaults.httpAgent) {
        api.defaults.httpAgent.destroy()
    }
}


export function getInfo() {
    return api.get('info')
}

export function displayResults(data) {
    console.log(chalk.green.bold('===='))

    if (Array.isArray(data)) {
        // Handle array data
        data.reverse().forEach((item, index) => {
            console.log(chalk.white.bold(`${index}`))
            for (const [key, value] of Object.entries(item)) {
                console.log(chalk.cyan(`${key}:`), typeof value === 'object'
                    ? JSON.stringify(value, null, 2)
                    : value)
            }
        })
    } else if (typeof data === 'object' && data !== null) {
        // Handle object data
        for (const [key, value] of Object.entries(data)) {
            console.log(chalk.cyan.bold(`${key}:`))
            if (typeof value === 'object' && value !== null) {
                console.log(JSON.stringify(value, null, 2))
            } else {
                console.log(value)
            }
        }
    } else {
        // Handle primitive data
        console.log(chalk.yellow(data))
    }

    console.log(chalk.green.bold('===='))
}

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}


export function loadKnownIDs() {
    // Load existing known IDs from file or initialize with defaults
    try {
        if (fs.existsSync(KNOWN_IDS_FILE)) {
            const fileData = fs.readFileSync(KNOWN_IDS_FILE, 'utf8')
            KNOWN_IDS = JSON.parse(fileData)
        } else {
            // Initialize with defaults if file doesn't exist
            KNOWN_IDS = {
            }
            // Save initial data
            fs.writeFileSync(KNOWN_IDS_FILE, JSON.stringify(KNOWN_IDS, null, 2), 'utf8')
        }
    } catch (error) {
        console.error(chalk.red(`Error loading known IDs: ${error.message}`))
    }
}

export async function createHolding(holdingType, name = null) {
    let uuid = generateUUID()
    const requestData = {
        entry: uuid,
        holdingType: holdingType
    }

    console.log(chalk.blue.bold(`Creating new ${holdingType} holding, UUID: ${uuid}`))
    let data = await api.post('holdings', requestData)
    displayResults(data)

    // If name is provided, save the ID to the known IDs
    if (name) {
        KNOWN_IDS[name] = uuid
        // Save updated known IDs to file
        try {
            fs.writeFileSync(KNOWN_IDS_FILE, JSON.stringify(KNOWN_IDS, null, 2), 'utf8')
            console.log(chalk.green(`Saved ID for ${name} to ${KNOWN_IDS_FILE}`))
        } catch (error) {
            console.error(chalk.red(`Error saving known IDs: ${error.message}`))
        }
    }

    return uuid
}

// Helper functions for ID-name conversion
export function getNameById(id) {
    for (const [name, holdingId] of Object.entries(KNOWN_IDS)) {
        if (holdingId === id) return name
    }
    return "Unknown"
}

export function getIdByName(name) {
    return KNOWN_IDS[name] || "???"
}

export async function getHoldings() {
    try {
        const listHoldings = await api.get("holdings")
        let holdings = {}
        for (const holding of listHoldings.items) {
            try {
                const uuid = holding.entry
                if (!uuid) continue

                const holdingDetails = await api.get(`holdings/${uuid}`)
                // determine key: use name if known, otherwise use UUID
                const name = getNameById(uuid)
                // const key = name !== 'Unknown' ? name : uuid
                holdings[uuid] = {
                    id: uuid,
                    name: name,
                    amount: holdingDetails.balance.amount.amount,
                    available: holdingDetails.balance.availableAmount.amount,
                    type: holdingDetails.holdingType,
                }
            } catch (err) {
                console.error(chalk.red(`Error fetching details for holding: ${holding.entry}`), err.message)
                // Continue with next holding even if one fails
            }
        }
        return holdings
    } catch (err) {
        console.error(chalk.red('Error in getHoldings:'), err.message)
        throw err
    }
}

export function displayHoldings(holdings) {
    console.log(holdings)
    console.log(chalk.blue.bold('\nHoldings'))

    const table = new Table({
        head: ['Name', 'Type', 'Available', 'Reserved', 'ID'],
        style: {
            head: ['bold', 'white']
        },
        colWidths: [15, 15, 15, 15, 40]
    });

    // Sort and add entries to table
    Object.keys(holdings)
        .sort((a, b) => holdings[a].name.localeCompare(holdings[b].name))
        .forEach(name => {
            const h = holdings[name];
            table.push([
                h.name,
                h.type === "endUser" ? chalk.green(h.type) : chalk.yellow(h.type),
                h.available,
                h.amount - h.available ? chalk.red.bold(h.amount - h.available) : 0,
                chalk.gray(h.id)
            ]);
        });

    console.log(table.toString());
}

export async function createReservation(from, to, amount) {
    // Reservation for 1 hour
    const expiryDate = new Date()
    expiryDate.setHours(expiryDate.getHours() + 1)
    let holdings = await getHoldings()

    if (!holdings) {
        console.error("Could not get holdings!")
        return null
    } else if (!holdings[from]) {
        console.error("Sender does not have a d€ account")
        return null
    } else if (!holdings[to]) {
        console.error("Receiver does not have a d€ account")
        return null
    }

    const requestData = {
        debtorEntry: holdings[from].id,
        creditorEntry: holdings[to].id,
        amount: {
            amount: amount,
            currency: 'EUR'
        },
        expiryDate: expiryDate.toISOString()
    }
    const rsvID = generateUUID()
    console.log(chalk.blue.bold(`Creating new reservation`))
    console.log(`  ${amount}€ ${from} → ${to}`)
    console.log(chalk.gray(`  Reservation id: ${rsvID}`))
    await api.post("reservations/" + rsvID, requestData)

    const r2 = await api.get("reservations/" + rsvID)
    // console.log(r2)
    if (r2.reservationStatus === "ENAB") {
        console.log(chalk.green("  ✔️  Reservation active"))
    } else {
        console.log(chalk.red("  Reservation is not active"))
    }
    return rsvID
}

export async function createPayment(from, to, amount) {
    console.log(chalk.blue.bold(`Creating payment via reservation`))
    console.log(`  ${amount}€ ${from} → ${to}`)

    const holdings = await getHoldings()
    if (!holdings) {
        console.error("Could not get holdings!")
        return null
    }

    const fromId = Object.keys(holdings).find(k => holdings[k].name === from) || from
    const toId = Object.keys(holdings).find(k => holdings[k].name === to) || to


    const rsvID = await createReservation(fromId, toId, amount)
    if (!rsvID) {
        return null
    }

    const paymentID = await createPaymentFromReservation(rsvID, amount)
    return paymentID
    // const paymentRequestData = {
    //     debtorEntry: fromId,
    //     creditorEntry: toId,
    //     amount: {
    //         amount: amount,
    //         currency: 'EUR'
    //     }
    // }

    // const payment = await api.post("payments", paymentRequestData)
    // console.log(payment)
    // const paymentDetails = await api.get("payments/" + paymentID)
    // // console.log(paymentDetails)
    // if (paymentDetails.paymentStatus === "ACCC") {
    //     console.log(chalk.green("  ✔️  Payment accepted"))
    //     return paymentID
    // } else {
    //     console.log(chalk.red("Payment not executed"))
    // }

}

export async function createPaymentFromReservation(rsvID, amount) {
    const paymentID = generateUUID()
    console.log(chalk.blue.bold(`Creating payment from reservation`))
    console.log(`  ${amount}€ payed from reservation ${rsvID}`)
    console.log(chalk.gray(`  Payment id: ${paymentID}`))

    const paymentRequestData = {
        reservationId: rsvID,
        amount: {
            amount: amount,
            currency: 'EUR'
        },
        reserveRemaining: false // we don't keep the reservation
    }
    const payment = await api.post("payments/" + paymentID, paymentRequestData)
    console.log(payment)
    const paymentDetails = await api.get("payments/" + paymentID)
    // console.log(paymentDetails)
    if (paymentDetails.paymentStatus === "ACCC") {
        console.log(chalk.green("  ✔️  Payment accepted"))
        return paymentID
    } else {
        console.log(chalk.red("Payment not executed"))
    }

}

export async function listReservations(params = {}) {
    console.log(chalk.blue.bold('\nList Reservations'));
    const data = await api.get('reservations', { params });
    displayResults(data);
}

export async function getReservationById(id) {
    console.log(chalk.blue.bold(`\nGet Reservation ${id}`));
    const data = await api.get('reservations/' + id);
    displayResults(data);
}

export async function updateReservation(id, amount, expiryHours) {
    const requestData = {};
    if (amount !== undefined) requestData.amount = { amount, currency: 'EUR' };
    if (expiryHours !== undefined) {
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + expiryHours);
        requestData.expiryDate = expiryDate.toISOString();
    }
    console.log(chalk.blue.bold(`\nUpdate Reservation ${id}`));
    const data = await api.post('reservations/' + id, requestData);
    displayResults(data);
}

export async function getPayment(paymentId) {
    console.log(chalk.blue.bold(`\nGet Payment ${paymentId}`));
    const data = await api.get('payments/' + paymentId);
    displayResults(data);
}

export async function getHolding(nameOrId) {
    const id = KNOWN_IDS[nameOrId] || nameOrId;
    console.log(chalk.blue.bold(`\nGet Holding ${nameOrId} (${id})`));
    const data = await api.get('holdings/' + id);
    displayResults(data);
}

export function usage() {
    console.log(chalk.green('\nUsage: node interact.js <resource> <action> [options]'));
    console.log('Resources and actions:');
    console.log('  info');
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
