const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

const crmAttachmentAnalysis = require("../skills/crmAttachmentAnalysis");
const salesQuoteContextQuery = require("../skills/salesQuoteContextQuery");

function createSalesQuoteTools(baseCtx) {

    const salesQuoteContextQueryTool = tool(
        async ({
            prompt,
            salesQuoteDisplayId,
            memory,
            grounding,
            plan
        }) => {
            const result = await salesQuoteContextQuery({
                ...baseCtx,
                prompt,
                salesQuoteDisplayId,
                memory,
                grounding,
                plan
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
                salesQuoteDisplayId: z.string(),
                memory: z.any().optional(),
                grounding: z.any().optional(),
                plan: z.any().optional()
            })
        }
    );

    const crmAttachmentAnalysisTool = tool(
        async ({
            prompt,
            salesQuoteDisplayId,
            memory,
            grounding,
            plan
        }) => {
            const goal = plan?.goal || "analyze_attachment";

            const intentJson = {
                hasDocument: false,

                // Preserve the original business goal.
                activity: goal,
                goal,

                confidence: plan?.confidence ?? 1,
                businessobject: "salesQuotes",
                service: "sales-quote-service",
                operation: "read",
                task: prompt,
                filter: {
                    displayId: salesQuoteDisplayId
                },
                select: [],
                payload: {},

                requiresAttachment:
                    plan?.requiresAttachment !== false,

                requiresSalesQuoteData:
                    plan?.requiresSalesQuoteData !== false
            };

            console.log(
                "CRM attachment tool goal:",
                goal
            );

            const result = await crmAttachmentAnalysis({
                ...baseCtx,
                prompt,
                intentJson,
                memory,
                grounding,
                plan
            });

            return typeof result === "string"
                ? result
                : JSON.stringify(result);
        },
        {
            name: "crm_attachment_analysis",
            description:
                "Use this tool to retrieve and analyze the latest attachment of a specific Sales Quote, prepare attachment-based emails and support attachment summary email workflows.",
            schema: z.object({
                prompt: z.string(),
                salesQuoteDisplayId: z.string(),
                memory: z.any().optional(),
                grounding: z.any().optional(),
                plan: z.any().optional()
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