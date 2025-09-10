
const utilFunctions = require("./service-query");
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
    if (operation === "read") {
        res = await utilFunctions.getC4CEntity(endpoint, destC4C, authHeader);
    } else {
        res = await utilFunctions.postC4CEntity(endpoint, intentJson.payload, destC4C, authHeader);
    }

    return res;
}

/**
 * To summarize the response
 * @param {*} orchestration 
 * @param {*} c4cResponse 
 * @param {*} label 
 * @returns 
 */
async function _summarize(orchestration, c4cResponse, label) {

    // Ask LLM to summarize
    const summaryResp = await orchestration.chatCompletion({
        inputParams: {
            question: `Shows the field ${label} from: ${JSON.stringify(c4cResponse.slice(0, 5))}`
        }
    });
    return summaryResp.getContent();
}

module.exports = {
    checkBONames,
    _C4CApi,
    _summarize
}