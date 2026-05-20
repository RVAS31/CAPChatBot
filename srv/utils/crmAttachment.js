const {
    getC4CData,
    getC4CEntity,
    getBinaryFromUrl
} = require("./service-query");

/**
 * Reads a Sales Quote by displayId.
 */
async function readSalesQuoteByDisplayId(destC4C, authHeader, displayId) {
    const endpoint =
        `sales-quote-service/salesQuotes?$filter=displayId eq '${displayId}'`;

    const results = await getC4CEntity(endpoint, destC4C, authHeader);
    return results?.[0] || null;
}

/**
 * Extracts latest attachment/document id from Sales Quote payload.
 * Adjust fields after seeing your real Sales Quote response.
 */
function getLatestAttachmentId(salesQuote) {
    const attachments =
        salesQuote?.attachments || [];

    if (!Array.isArray(attachments) || attachments.length === 0) {
        return null;
    }

    const latest = attachments[attachments.length - 1];

    return (
        latest.id || null
    );
}

/**
 * Gets temporary document download URL from C4C document-service.
 */
async function getDocumentDownloadUrl(destC4C, authHeader, documentId) {
    const endpoint = `document-service/documents/${documentId}/download`;
    const data = await getC4CData(endpoint, destC4C, authHeader);

    return data?.value?.url || null;
}

/**
 * Extract filename from content-disposition or presigned URL.
 */
function extractFileName(downloadUrl, contentDisposition) {
    const cdMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);
    if (cdMatch?.[1]) {
        return decodeURIComponent(cdMatch[1]);
    }

    const urlMatch = downloadUrl.match(/filename%3D%22([^%]+)%22/i);
    if (urlMatch?.[1]) {
        return decodeURIComponent(urlMatch[1]);
    }

    return "crm-attachment.docx";
}

module.exports = {
    readSalesQuoteByDisplayId,
    getLatestAttachmentId,
    getDocumentDownloadUrl,
    getBinaryFromUrl,
    extractFileName
};