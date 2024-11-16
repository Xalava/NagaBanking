const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("NagaEx1", (m) => {
    const USDC = m.contract("Stablecoin", ["Mock USDC stablecoin", "USDC"]);
    console.log(USDC)

    const nagaex = m.contract("NagaExchange", [USDC]);
    console.log(nagaex);
    // m.call(apollo, "launch", []);

    return { USDC };
});
