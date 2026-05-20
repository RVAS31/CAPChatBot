// srv/skills/crmAttachmentAnalysis.js

const {
    readSalesQuoteByDisplayId,
    getLatestAttachmentId,
    getDocumentDownloadUrl,
    getBinaryFromUrl,
    extractFileName
} = require("../utils/crmAttachment");

const { buildC4CAuthHeader } = require("../utils/service-functions");
const { extractTextFromBuffer } = require("../utils/documentExtraction");

const nextBestAction = require("./nextBestAction");
const docExtract = require("./docExtract");
const docQa = require("./docQa");
const draftEmail = require("./draftEmail");

async function decideFollowUpSkill(ctx, extractedText) {
    const {
        OrchestrationClient,
        destAI,
        prompt,
        intentJson,
        prompts
    } = ctx;

    const routerClient = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.crmAttachmentFollowUpRouter.content_system
                },
                {
                    role: "user",
                    content: prompts.crmAttachmentFollowUpRouter.content_user
                }
            ]
        }
    });

    const response = await routerClient.chatCompletion({
        inputParams: {
            question: prompt,
            intentJson: JSON.stringify(intentJson || {}),
            documentText: extractedText || ""
        }
    });

    try {
        const parsed = JSON.parse(response.getContent());
        const skill = parsed.followUpSkill;

        if (
            skill === "doc_extract" ||
            skill === "doc_qa" ||
            skill === "draft_email" ||
            skill === "next_best_action"
        ) {
            return skill;
        }

        return "doc_qa";
    } catch (e) {
        console.error("Could not parse follow-up skill decision:", response.getContent());
        return "doc_qa";
    }
}

module.exports = async function crmAttachmentAnalysis(ctx) {
    const {
        intentJson,
        destC4C,
        Documents,
        DocumentAnalysis,
        JSZip,
        uuidv4
    } = ctx;

    const displayId =
        intentJson?.filter?.displayId;

    if (!displayId) {
        return "I could not identify the Sales Quote displayId. Please specify it, for example: “Analyze the attachment of sales quote displayId 35.”";
    }

    const authHeader = buildC4CAuthHeader(destC4C);

    const salesQuote = await readSalesQuoteByDisplayId(
        destC4C,
        authHeader,
        displayId
    );

    if (!salesQuote) {
        return `I could not find a Sales Quote with displayId ${displayId}.`;
    }

    const crmDocumentId = getLatestAttachmentId(salesQuote);

    if (!crmDocumentId) {
        return `I found Sales Quote ${displayId}, but it does not contain any attachment I can analyze.`;
    }

    const downloadUrl = await getDocumentDownloadUrl(
        destC4C,
        authHeader,
        crmDocumentId
    );

    if (!downloadUrl) {
        return `I found an attachment for Sales Quote ${displayId}, but CRM did not return a download URL.`;
    }

    const { buffer, mimeType, contentDisposition } = await getBinaryFromUrl(downloadUrl);

    const fileName = extractFileName(downloadUrl, contentDisposition);

    const extractedText = await extractTextFromBuffer(
        buffer,
        fileName,
        mimeType,
        JSZip
    );

    if (!extractedText?.trim()) {
        return `I retrieved the attachment "${fileName}", but I could not extract readable text from it.`;
    }

    const internalDocumentId = uuidv4();

    await INSERT.into(Documents).entries({
        ID: internalDocumentId,
        fileName,
        mimeType: mimeType || "",
        size: buffer.length,
        extractedText,
        createdAt: new Date(),
        createdBy: "crm-attachment"
    });

    const followUpSkill = await decideFollowUpSkill(
        {
            ...ctx,
            documentId: internalDocumentId,
            docText: extractedText
        },
        extractedText
    );

    console.log("CRM attachment follow-up skill:", followUpSkill);

    const skillCtx = {
        ...ctx,
        docText: extractedText,
        documentId: internalDocumentId,
        DocumentAnalysis
    };

    switch (followUpSkill) {
        case "next_best_action":
            return await nextBestAction(skillCtx);

        case "doc_extract":
            return await docExtract(skillCtx);

        case "draft_email":
            return await draftEmail(skillCtx);

        case "doc_qa":
        default:
            return await docQa(skillCtx);
    }
};