const { extractReportMarker } = require("../utils/reportMarker");
const { runSalesQuoteAgent } = require("../agents/salesQuoteAgent");

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
    } = deps;

    srv.on("askSalesQuoteAgent", async (req) => {
        const { prompt, salesQuoteDisplayId, sessionId } = req.data;

        if (!prompt) req.error(400, "Prompt is required");
        if (!salesQuoteDisplayId) req.error(400, "Sales Quote displayId is required");

        const destAI = await getDestination({ destinationName: "ai-core-destination-btp" });
        const destC4C = await getDestination({ destinationName: "CloudV2" });

        if (!destAI) req.error(500, "AI Core destination not found");
        if (!destC4C) req.error(500, "C4C destination not found");

        const sessionContext = sessionId && ConversationContext
            ? await SELECT.one.from(ConversationContext).where({ sessionId })
            : null;

        const agentResult = await runSalesQuoteAgent({
            OrchestrationClient,
            destAI,
            destC4C,
            prompts,
            prompt,
            salesQuoteDisplayId,
            sessionContext,
            Documents,
            DocumentAnalysis,
            JSZip,
            uuidv4
        });

        const skillResult = agentResult.result;
        console.log("Sales Quote Agent sources:", skillResult.sources || []);
        const resultActivity = agentResult.activity;

        const finalAnswer =
            typeof skillResult === "string"
                ? skillResult
                : skillResult.text;

        const resultDocumentId =
            typeof skillResult === "object" && skillResult.documentId
                ? skillResult.documentId
                : sessionContext?.lastDocument_ID || null;

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

                lastDocument_ID:
                    resultDocumentId || sessionContext?.lastDocument_ID || null,

                lastActivity: resultActivity,

                lastBusinessObject: "salesQuotes",

                lastObjectId: salesQuoteDisplayId,

                createdAt: sessionContext?.createdAt || new Date(),
                updatedAt: new Date(),

                lastSuggestedSkills: JSON.stringify({
                    activity: resultActivity,
                    sources: skillResult.sources || []
                })
            });
        }

        return cleanedText;
    });
};