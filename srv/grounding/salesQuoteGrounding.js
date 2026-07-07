const {
    readSalesQuoteByDisplayId,
    getLatestAttachmentId,
    getDocumentDownloadUrl,
    getBinaryFromUrl,
    extractFileName
} = require("../utils/crmAttachment");

const { buildC4CAuthHeader } = require("../utils/service-functions");
const { extractTextFromBuffer } = require("../utils/documentExtraction");


async function loadDocumentFromMemory(ctx) {
    const lastDocumentId = ctx.memory?.lastDocumentId;

    if (!lastDocumentId || !ctx.Documents) return null;

    const previousDocument = await SELECT.one
        .from(ctx.Documents)
        .where({ ID: lastDocumentId });

    if (!previousDocument?.extractedText?.trim()) return null;

    return {
        internalDocumentId: lastDocumentId,
        extractedText: previousDocument.extractedText,
        fileName: previousDocument.fileName,
        mimeType: previousDocument.mimeType || null
    };
}

async function downloadAndStoreLatestAttachment(ctx, salesQuote, authHeader) {
    const crmDocumentId = getLatestAttachmentId(salesQuote);

    if (!crmDocumentId) {
        return {
            error: "This Sales Quote does not contain any attachment I can analyze."
        };
    }

    const downloadUrl = await getDocumentDownloadUrl(
        ctx.destC4C,
        authHeader,
        crmDocumentId
    );

    if (!downloadUrl) {
        return {
            error: "CRM did not return a download URL for the attachment."
        };
    }

    const { buffer, mimeType, contentDisposition } =
        await getBinaryFromUrl(downloadUrl);

    const fileName = extractFileName(downloadUrl, contentDisposition);

    const extractedText = await extractTextFromBuffer(
        buffer,
        fileName,
        mimeType,
        ctx.JSZip
    );

    if (!extractedText?.trim()) {
        return {
            error: `I retrieved the attachment "${fileName}", but I could not extract readable text from it.`
        };
    }

    const internalDocumentId = ctx.uuidv4();

    await INSERT.into(ctx.Documents).entries({
        ID: internalDocumentId,
        fileName,
        mimeType: mimeType || "",
        size: buffer.length,
        extractedText,
        createdAt: new Date(),
        createdBy: "crm-attachment"
    });

    return {
        crmDocumentId,
        internalDocumentId,
        extractedText,
        fileName,
        mimeType: mimeType || null
    };
}

async function buildSalesQuoteGrounding(ctx) {
    const grounding = {
        salesQuote: null,

        attachment: {
            crmDocumentId: null,
            extractedText: null,
            internalDocumentId: null,
            fileName: null,
            mimeType: null,
            error: null
        },

        conversation: {
            lastPrompt: ctx.memory?.lastPrompt || null,
            lastResponse: ctx.memory?.lastResponse || null,
            lastActivity: ctx.memory?.lastActivity || null,
            lastBusinessObject: ctx.memory?.lastBusinessObject || null,
            lastObjectId: ctx.memory?.lastObjectId || null
        },

        sources: []
    };

    const authHeader = buildC4CAuthHeader(ctx.destC4C);

    if (ctx.reasoning?.needsSalesQuoteData) {
        const salesQuote = await readSalesQuoteByDisplayId(
            ctx.destC4C,
            authHeader,
            ctx.salesQuoteDisplayId
        );

        grounding.salesQuote = salesQuote || null;

        if (salesQuote) {
            grounding.sources.push("CRM Sales Quote");
        } else {
            return grounding;
        }
    }

    if (ctx.reasoning?.reuseAttachment) {
        const memoryAttachment = await loadDocumentFromMemory(ctx);

        if (memoryAttachment) {
            grounding.attachment = {
                ...grounding.attachment,
                ...memoryAttachment
            };

            grounding.sources.push("CRM Attachment");
            return grounding;
        }
    }

    if (ctx.reasoning?.loadAttachmentFromCRM) {
        const attachment = await downloadAndStoreLatestAttachment(
            ctx,
            grounding.salesQuote,
            authHeader
        );

        if (attachment.error) {
            grounding.attachment.error = attachment.error;
            return grounding;
        }

        grounding.attachment = {
            ...grounding.attachment,
            ...attachment
        };

        grounding.sources.push("CRM Attachment");
    }

    return grounding;
}

module.exports = {
    buildSalesQuoteGrounding
};