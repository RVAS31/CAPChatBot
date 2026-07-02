const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

const crmAttachmentAnalysis = require("../skills/crmAttachmentAnalysis");
const salesQuoteContextQuery = require("../skills/salesQuoteContextQuery");

function createSalesQuoteTools(baseCtx) {
    const salesQuoteContextQueryTool = tool(
        async ({ prompt, salesQuoteDisplayId }) => {
            const result = await salesQuoteContextQuery({
                ...baseCtx,
                prompt,
                salesQuoteDisplayId
            });

            return typeof result === "string"
                ? result
                : JSON.stringify(result);
        },
        {
            name: "sales_quote_context_query",
            description:
                "Use this tool to answer questions about a specific Sales Quote using CRM Sales Cloud V2 data.",
            schema: z.object({
                prompt: z.string(),
                salesQuoteDisplayId: z.string()
            })
        }
    );

    const crmAttachmentAnalysisTool = tool(
        async ({ prompt, salesQuoteDisplayId }) => {
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

            const result = await crmAttachmentAnalysis({
                ...baseCtx,
                prompt,
                intentJson,
                docText: "",
                documentId: null
            });

            return typeof result === "string"
                ? result
                : JSON.stringify(result);
        },
        {
            name: "crm_attachment_analysis",
            description:
                "Use this tool to retrieve and analyze the latest attachment of a specific Sales Quote.",
            schema: z.object({
                prompt: z.string(),
                salesQuoteDisplayId: z.string()
            })
        }
    );

    return [
        salesQuoteContextQueryTool,
        crmAttachmentAnalysisTool
    ];
}

module.exports = {
    createSalesQuoteTools
};