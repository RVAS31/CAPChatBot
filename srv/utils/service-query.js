const axios = require("axios"); // to call C4C APIs

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
        console.log("endpoint:", endpoint);
        const results = res.data?.value || [];

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

/**
 * 
 * @param {*} endpoint 
 * @param {*} destC4C 
 * @param {*} authHeader 
 * @returns 
 */
async function getC4CData(endpoint, destC4C, authHeader) {
    try {
        const res = await axios.get(
            `/sap/c4c/api/v1/${endpoint}`,
            {
                baseURL: destC4C.url,
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json"
                }
            }
        );

        return res.data;

    } catch (error) {
        console.error("Error during GET to C4C:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * Downloads binary from a temporary absolute URL, e.g. S3 presigned URL.
 * No C4C auth header needed because URL is already signed.
 */
async function getBinaryFromUrl(downloadUrl) {
    try {
        const res = await axios.get(downloadUrl, {
            responseType: "arraybuffer"
        });

        return {
            buffer: Buffer.from(res.data),
            mimeType: res.headers["content-type"] || "",
            contentDisposition: res.headers["content-disposition"] || ""
        };

    } catch (error) {
        console.error("Error downloading binary:", error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    getC4CEntity,
    postC4CEntity,
    getC4CData,
    getBinaryFromUrl
}