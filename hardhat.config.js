require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

if (!process.env['SEED']) {
  throw new Error(`Missing required environment variable SEED`);
}


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.27",

  networks: {
    hardhat: {
      accounts: {
        mnemonic: process.env.SEED,
      },
      // chainId: 31337,
    },
    arbitrum: {
      url: `https://arb1.arbitrum.io/rpc`,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 42161,
    },
    arbitrumGoerli: {
      url: `https://goerli-rollup.arbitrum.io/rpc`,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 421613,
    },
    scroll: {
      url: 'https://rpc.scroll.io',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 534352,
    },
    scrollSepolia: {
      url: 'https://sepolia-rpc.scroll.io',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 534351,
    },
    gnosis: {
      url: 'https://rpc.gnosischain.com',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 100,
    },
    base: {
      url: 'https://mainnet.base.org',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453,
    },
    baseGoerli: {
      url: 'https://goerli.base.org',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84531,
    },
    zircuit: {
      url: process.env.ZIRCUIT_RPC || 'https://rpc.zircuit.com',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 58008,
    },
    kinto: {
      url: process.env.KINTO_RPC || 'https://rpc.kinto.xyz',
      accounts: [process.env.PRIVATE_KEY],
    },
    bitkub: {
      url: 'https://rpc.bitkubchain.io',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 96,
    },
    bitkubTestnet: {
      url: 'https://rpc-testnet.bitkubchain.io',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 25925,
    },
    near: {
      url: process.env.NEAR_URL || 'https://rpc.mainnet.near.org',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1313161554,
    },
    nearTestnet: {
      url: 'https://rpc.testnet.near.org',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1313161555,
    },
    hedera: {
      url: process.env.HEDERA_RPC || 'https://mainnet.hashio.io/api',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 295,
    },
    hederaTestnet: {
      url: 'https://testnet.hashio.io/api',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 296,
    },
    celo: {
      url: 'https://forno.celo.org',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 42220,
    },
    celoTestnet: {
      url: 'https://alfajores-forno.celo-testnet.org',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 44787,
    },
  },
};



