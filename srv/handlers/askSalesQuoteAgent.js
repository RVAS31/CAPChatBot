const { extractReportMarker } = require("../utils/reportMarker");
const crmAttachmentAnalysis = require("../skills/crmAttachmentAnalysis");
const salesQuoteContextQuery = require("../skills/salesQuoteContextQuery");

function isAttachmentRequest(prompt) {
    const text = (prompt || "").toLowerCase();

    return (
        text.includes("attachment") ||
        text.includes("document") ||
        text.includes("file") ||
        text.includes("analyze") ||
        text.includes("summarize") ||
        text.includes("extract") ||
        text.includes("risk") ||
        text.includes("commercial risk") ||
        text.includes("email") ||
        text.includes("reply") ||
        text.includes("next best action")
    );
}

async function decideSalesQuoteRoute(ctx) {
    const {
        OrchestrationClient,
        destAI,
        prompts,
        prompt,
        salesQuoteDisplayId,
        sessionContext
    } = ctx;

    const routerClient = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.salesQuoteAgentRouter.content_system
                },
                {
                    role: "user",
                    content: prompts.salesQuoteAgentRouter.content_user
                }
            ]
        }
    });

    const response = await routerClient.chatCompletion({
        inputParams: {
            question: prompt,
            salesQuoteDisplayId,
            conversationContext: JSON.stringify(sessionContext || {})
        }
    });

    try {
        const parsed = JSON.parse(response.getContent());

        if (
            parsed.route === "sales_quote_context_query" ||
            parsed.route === "crm_attachment_analysis"
        ) {
            return parsed.route;
        }

        return "sales_quote_context_query";
    } catch (e) {
        console.error("Could not parse Sales Quote route:", response.getContent());
        return "sales_quote_context_query";
    }
}

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

        const destAI = await getDestination({ destinationName: "ai-core-destination-btp" });
        const destC4C = await getDestination({ destinationName: "CloudV2" });

        if (!destAI) req.error(500, "AI Core destination not found");
        if (!destC4C) req.error(500, "C4C destination not found");

        const sessionContext = sessionId && ConversationContext
            ? await SELECT.one.from(ConversationContext).where({ sessionId })
            : null;

        let skillResult;
        let resultActivity;

        const selectedRoute = await decideSalesQuoteRoute({
            OrchestrationClient,
            destAI,
            prompts,
            prompt,
            salesQuoteDisplayId,
            sessionContext
        });

        console.log("Sales Quote Agent route:", selectedRoute);

        if (selectedRoute === "crm_attachment_analysis") {
            resultActivity = "crm_attachment_analysis";

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

            skillResult = await crmAttachmentAnalysis({
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

        } else {
            resultActivity = "sales_quote_context_query";

            skillResult = await salesQuoteContextQuery({
                OrchestrationClient,
                destAI,
                destC4C,
                prompts,
                prompt,
                salesQuoteDisplayId
            });
        }

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
                lastDocument_ID: resultDocumentId || sessionContext?.lastDocument_ID || null,
                lastActivity: resultActivity,
                lastBusinessObject: "salesQuotes",
                lastObjectId: salesQuoteDisplayId,
                createdAt: sessionContext?.createdAt || new Date(),
                updatedAt: new Date()
            });
        }

        return cleanedText;
    });
};