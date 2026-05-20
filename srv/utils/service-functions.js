const utilFunctions = require("./service-query");
const { TYPEREQUEST } = require("./type-operator");

function checkBONames(BOName) {
    const names = ["accounts", "contactPersons", "salesQuotes"];
    return names.includes(BOName);
}

function buildC4CAuthHeader(destC4C) {
    return "Basic " + Buffer
        .from(`${destC4C.username}:${destC4C.password}`)
        .toString("base64");
}

async function _C4CApi(destC4C, intentJson) {
    const endpoint = `${intentJson.service}/${intentJson.businessobject}`;
    const operation = intentJson.operation;
    const authHeader = buildC4CAuthHeader(destC4C);

    if (operation === TYPEREQUEST.READ) {
        return await utilFunctions.getC4CEntity(endpoint, destC4C, authHeader);
    }

    return await utilFunctions.postC4CEntity(
        endpoint,
        intentJson.payload,
        destC4C,
        authHeader
    );
}

module.exports = {
    checkBONames,
    _C4CApi,
    buildC4CAuthHeader
};