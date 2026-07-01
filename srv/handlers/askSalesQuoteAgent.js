const { extractReportMarker } = require("../utils/reportMarker");
const crmAttachmentAnalysis = require("../skills/crmAttachmentAnalysis");

module.exports = function registerAskSalesQuoteAgent(srv, deps) {
    const {
        AICollection,
        Documents,
        DocumentAnalysis,
        ConversationContext,
        getDestination,
        OrchestrationClient,
        prompts,
        JSZip,
        uuidv4,
        _C4CApi
    } = deps;

    srv.on("askSalesQuoteAgent", async (req) => {
        const { prompt, salesQuoteDisplayId, sessionId } = req.data;

        if (!prompt) req.error(400, "Prompt is required");
        if (!salesQuoteDisplayId) req.error(400, "Sales Quote displayId is required");

        const destAI = await getDestination({ destinationName: "ai-core-destination-chatboxcloudv2" });
        const destC4C = await getDestination({ destinationName: "CloudV2" });

        if (!destAI) req.error(500, "AI Core destination not found");
        if (!destC4C) req.error(500, "C4C destination not found");

        const sessionContext = sessionId && ConversationContext
            ? await SELECT.one.from(ConversationContext).where({ sessionId })
            : null;

        const intentJson = {
            hasDocument: false,
            activity: "crm_attachment_analysis",
            confidence: 1,
            businessobject: "salesQuotes",
            service: "sales-quote-service",
            operation: "read",
            task: prompt,
            filter: {
                displayId: salesQuoteDisplayId
            },
            select: [],
            payload: {}
        };

        const skillResult = await crmAttachmentAnalysis({
            OrchestrationClient,
            destAI,
            destC4C,
            prompts,
            prompt,
            intentJson,
            docText: "",
            documentId: null,
            sessionContext,
            Documents,
            DocumentAnalysis,
            JSZip,
            uuidv4,
            _C4CApi
        });

        const finalAnswer =
            typeof skillResult === "string"
                ? skillResult
                : skillResult.text;

        const resultDocumentId =
            typeof skillResult === "object" && skillResult.documentId
                ? skillResult.documentId
                : null;

        const { cleanedText, isReport } = extractReportMarker(finalAnswer);

        await INSERT.into(AICollection).entries({
            prompt,
            response: cleanedText,
            isReport,
            createdAt: new Date(),

            document_ID: resultDocumentId || null,
            sessionId,
            businessObject: "salesQuotes",
            objectId: salesQuoteDisplayId
        });

        if (sessionId && ConversationContext) {
            await UPSERT.into(ConversationContext).entries({
                ID: sessionContext?.ID || uuidv4(),
                sessionId,
                lastPrompt: prompt,
                lastResponse: cleanedText,
                lastDocument_ID: resultDocumentId || sessionContext?.lastDocument_ID || null,
                lastActivity: "crm_attachment_analysis",
                lastBusinessObject: "salesQuotes",
                lastObjectId: salesQuoteDisplayId,
                createdAt: sessionContext?.createdAt || new Date(),
                updatedAt: new Date()
            });
        }

        return cleanedText;
    });
};