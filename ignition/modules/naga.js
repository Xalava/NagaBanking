const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("NagaEx1", (m) => {
    const deployConditionalPayment = m.getParameter("conditionalPayments", false);

    const stable = m.contract("Stablecoin", ["Euro X", "EURX"]);
    const userJson = require('../../frontend/user-ids.json');

    for (const user of userJson) {
        m.call(stable, "mint", [user.address, 1000 * 10 ** 6], { id: "mint" + user.name });
    }

    console.log(stable)

    const nagaex = m.contract("NagaExchange", [stable]);
    console.log(nagaex);

    const conditionalPayment = deployConditionalPayment ? m.contract("ConditionalPayment", [stable], { after: [nagaex] }) : null;

    for (const user of userJson) {
        m.call(stable, "approve", [nagaex, 10000 * 10 ** 6], { id: "approve" + user.name, from: user.address });
        if (conditionalPayment) {
            m.call(stable, "approve", [conditionalPayment, 10000 * 10 ** 6], { id: "approveCP" + user.name, from: user.address });
        }
    }

    const result = { stable, nagaex };
    if (conditionalPayment) {
        result.conditionalPayment = conditionalPayment;
    }
    return result;
});
