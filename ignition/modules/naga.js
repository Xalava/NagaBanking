const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("NagaEx1", (m) => {
    const stable = m.contract("Stablecoin", ["Euro X", "EURX"]);
    const userJson = require('../../frontend/user-ids.json');

    for (const user of userJson) {
        m.call(stable, "mint", [user.address, 1000 * 10 ** 6], { id: "mint" + user.name });
    }

    console.log(stable)

    const nagaex = m.contract("NagaExchange", [stable]);
    console.log(nagaex);

    for (const user of userJson) {
        m.call(stable, "approve", [nagaex, 10000 * 10 ** 6], { id: "approve" + user.name, from: user.address });
    }


    return { stable };
});
