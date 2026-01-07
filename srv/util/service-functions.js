
const utilFunctions = require("./service-query");
const { TYPEREQUEST } = require("./type-operator");
/**
 * to check the BO name
 * @param {*} BOName 
 * @returns 
 */
function checkBONames(BOName) {
    const names = ['accounts', 'contactPersons', 'salesQuotes'];
    return names.includes(BOName)
}

/**
 * To call C4C API with differente CRUD operations
 * @param {*} destC4C 
 * @param {*} intentJson contains the necessarily paramaters to move forward
 * @returns 
 */
async function _C4CApi(destC4C, intentJson) {

    //To define the endpoint to address
    const endpoint = `${intentJson.service}/${intentJson.businessobject}`;

    //To get the operation
    const operation = intentJson.operation;

    // Basic Auth header
    const authHeader =
        "Basic " + Buffer.from(`${destC4C.username}:${destC4C.password}`).toString("base64");

    let res;

    // Call C4C OData API
    if (operation === TYPEREQUEST.READ) {
        res = await utilFunctions.getC4CEntity(endpoint, destC4C, authHeader);
    } else {
        res = await utilFunctions.postC4CEntity(endpoint, intentJson.payload, destC4C, authHeader);
    }

    return res;
}


module.exports = {
    checkBONames,
    _C4CApi
}