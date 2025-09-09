const axios = require("axios"); // to call C4C APIs

function getBusinessObjectNames() {
    const names = ['Contact', 'Account', 'Opportunity', 'SalesQuote'];
    return names.join(', ');
}

/**
 * To fecth a BO
 * @param {*} destC4C 
 * @param {*} endpoint 
 * @returns 
 */
async function _fetchC4C(destC4C, endpoint) {

    // Basic Auth header
    const authHeader =
        "Basic " + Buffer.from(`${destC4C.username}:${destC4C.password}`).toString("base64");

    // Call C4C OData API
    const res = await axios.get(`/sap/c4c/api/v1/${endpoint}`, {
        baseURL: destC4C.url,
        headers: { Authorization: authHeader }
    });

    const results = res.data?.value || [];
    return results
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
    getBusinessObjectNames,
    _fetchC4C,
    _summarize
}