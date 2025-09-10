const axios = require("axios"); // to call C4C APIs

function getComposedQuery(query, request) {

    const queryWhere = request.query.SELECT.where; //where query -> filter 
    const queryTop = request.query.SELECT.limit.rows; //rows query -> top
    const querySkip = request.query.SELECT.limit.offset; //offset query -> skip
    const querySelect = request.query.SELECT.columns; // select query -> select
    console.log("queryselect", querySelect)

    if (queryWhere) {

        const isSearch = utilFunctions.getSearchCondition(queryWhere); //With this function, the search cases are considered.

        if (!isSearch) {
            //Check in diferent cases of multiple filters. It consideres operators as well as connectors

            const queryMultiFilters = utilFunctions.constructQueryFiltersString(queryWhere);

            if (query.includes("?")) {
                query = query + `$filter=${queryMultiFilters}`;
            } else {
                query = query + `?$filter=${queryMultiFilters}`;
            }

        } else {

            //This query search filter only applies in the cases that contains, startswith and endswith. Apparently,
            //it means that the mentioned filters will be translated into search. The weakness is that we cannot 
            //combined them with the other filters (from above). If the client side does the backend reponse will be bad request.

            const querySearchFilter = utilFunctions.getSearchQuery(queryWhere);

            if (query.includes("?")) {
                query = query + `$search=${querySearchFilter}`;
            } else {
                query = query + `?$search=${querySearchFilter}`;
            }

        }

    }
    if (querySelect) {

        //To get the items of select. It will be outcome as an array of strings
        const querySelectValues = utilFunctions.removeSufix(querySelect, '_id', 3);

        if (query.includes("?")) {
            query = query + `&$select=${querySelectValues}`;
        } else {
            query = query + `?$select=${querySelectValues}`;
        }
    }
    if (queryTop) {
        const queryTopValue = queryTop.val === 1000 ? 5 : queryTop.val;

        if (query.includes("?")) {
            query = query + `&$top=${queryTopValue}`;
        } else {
            query = query + `?$top=${queryTopValue}`;
        }
    }

    if (querySkip) {
        const querySkipValue = querySkip.val;

        if (query.includes("?")) {
            query = query + `&$skip=${querySkipValue}`;
        } else {
            query = query + `?$skip=${querySkipValue}`;
        }
    }

    return query;
}

/**
 * To get the c4c entity
 * @param {*} endpoint 
 * @param {*} destC4C 
 * @param {*} authHeader 
 * @returns 
 */
async function getC4CEntity(endpoint, destC4C, authHeader) {
    try {
        const res = await axios.get(
            `/sap/c4c/api/v1/${endpoint}`,   // API path
            {
                baseURL: destC4C.url,          // destination base URL
                headers: {
                    "Authorization": authHeader, // Basic or OAuth header
                    "Content-Type": "application/json" // must set for POST
                }
            }
        );

        const results = res.data?.value || [];
        console.log("GET successful:", results);
        return results;

    } catch (error) {
        console.error("Error during GET to C4C:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * To post the c4c entity
 * @param {*} endpoint 
 * @param {*} payload 
 * @param {*} destC4C 
 * @param {*} authHeader 
 * @returns 
 */
async function postC4CEntity(endpoint, payload, destC4C, authHeader) {
    try {
        const res = await axios.post(
            `/sap/c4c/api/v1/${endpoint}`,   // API path
            payload,                         // request body (JSON)
            {
                baseURL: destC4C.url,          // destination base URL
                headers: {
                    "Authorization": authHeader, // Basic or OAuth header
                    "Content-Type": "application/json" // must set for POST
                }
            }
        );

        console.log("POST successful:", res.data);
        return res.data;

    } catch (error) {
        console.error("Error during GET to C4C:", error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    getComposedQuery,
    getC4CEntity,
    postC4CEntity
}