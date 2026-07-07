const { StateGraph, END, START } = require("@langchain/langgraph");
const { createSalesQuoteTools } = require("../tools/salesQuoteTools");
const { buildSalesQuoteGrounding } = require("../grounding/salesQuoteGrounding");

function mapGoalToTool(goal) {
    switch (goal) {
        case "general_chat":
            return "general_chat";

        case "analyze_attachment":
        case "extract_attachment_information":
        case "draft_follow_up_email":
        case "suggest_next_best_action":
            return "crm_attachment_analysis";

        case "summarize_sales_quote":
        case "answer_sales_quote_question":
        default:
            return "sales_quote_context_query";
    }
}

function validateNormalizedResult(normalizedResult, grounding) {
    const text = normalizedResult?.text || "";

    if (!text.trim()) {
        return {
            ...normalizedResult,
            text: "I could not generate a response for this request.",
            validation: {
                valid: false,
                reason: "Empty response"
            }
        };
    }

    const forbiddenClaims = [
        "I created",
        "I have created",
        "I sent",
        "I have sent",
        "I updated",
        "I have updated",
        "I deleted",
        "I have deleted"
    ];

    const hasForbiddenClaim = forbiddenClaims.some(claim =>
        text.toLowerCase().includes(claim.toLowerCase())
    );

    if (hasForbiddenClaim) {
        return {
            ...normalizedResult,
            text:
                text +
                "\n\nNote: I have not performed any write action in CRM. Please review and execute any suggested action manually.",
            validation: {
                valid: true,
                warning: "Response contained possible unsupported action claim"
            }
        };
    }

    return {
        ...normalizedResult,
        validation: {
            valid: true,
            reason: "Response validated"
        }
    };
}

function buildReasoning(plan, loadedContext) {
    const needsAttachment = [
        "analyze_attachment",
        "extract_attachment_information",
        "draft_follow_up_email",
        "suggest_next_best_action"
    ].includes(plan.goal);

    const reuseAttachment =
        needsAttachment &&
        !!loadedContext?.hasMemoryDocument &&
        !!loadedContext?.lastDocumentId;

    return {
        needsSalesQuoteData: plan.requiresSalesQuoteData !== false || needsAttachment,
        needsAttachment,
        reuseAttachment,
        loadAttachmentFromCRM: needsAttachment && !reuseAttachment,
        askClarification: false,
        reason: plan.reason || ""
    };
}

function normalizeToolResult(toolResult, selectedToolName) {
    if (typeof toolResult === "string") {
        return {
            text: toolResult,
            documentId: null,
            sources: selectedToolName === "general_chat"
                ? ["Conversation"]
                : ["CRM Sales Quote"]
        };
    }

    return {
        text: toolResult.text || JSON.stringify(toolResult),
        documentId: toolResult.documentId || null,
        sources: toolResult.sources || (
            toolResult.documentId
                ? ["CRM Sales Quote", "CRM Attachment"]
                : ["CRM Sales Quote"]
        )
    };
}

function createSalesQuoteGraph(baseCtx) {

    const tools = createSalesQuoteTools(baseCtx);

    const graph = new StateGraph({
        channels: {
            prompt: null,
            salesQuoteDisplayId: null,
            sessionContext: null,
            memory: null,
            loadedContext: null,
            plan: null,
            selectedToolName: null,
            rawToolResult: null,
            normalizedResult: null,
            activity: null,
            grounding: null,
            validatedResult: null,
            reasoning: null,
        }
    });

    graph.addNode("validateInput", async (state) => {
        if (!state.prompt) {
            throw new Error("Prompt is required");
        }

        if (!state.salesQuoteDisplayId) {
            throw new Error("Sales Quote displayId is required");
        }

        if (!state.plan?.goal) {
            throw new Error("Sales Quote plan goal is required");
        }

        return state;
    });

    graph.addNode("loadContext", async (state) => {
        const loadedContext = {
            salesQuoteDisplayId: state.salesQuoteDisplayId,
            hasMemoryDocument: !!state.memory?.lastDocumentId,
            lastDocumentId: state.memory?.lastDocumentId || null,
            lastActivity: state.memory?.lastActivity || null,
            lastObjectId: state.memory?.lastObjectId || null,
            sources: []
        };

        console.log("Sales Quote Graph loaded context:", loadedContext);

        return {
            ...state,
            loadedContext
        };
    });

    graph.addNode("buildReasoning", async (state) => {
        const reasoning = buildReasoning(state.plan, state.loadedContext);

        console.log("Sales Quote Graph reasoning:", reasoning);

        return {
            ...state,
            reasoning
        };
    });

    graph.addNode("buildGrounding", async (state) => {
        const grounding = await buildSalesQuoteGrounding({
            ...baseCtx,
            prompt: state.prompt,
            salesQuoteDisplayId: state.salesQuoteDisplayId,
            memory: state.memory,
            loadedContext: state.loadedContext,
            reasoning: state.reasoning,
            plan: state.plan
        });

        console.log("Sales Quote Graph grounding:", grounding);

        return {
            ...state,
            grounding
        };
    });

    graph.addNode("selectTool", async (state) => {
        const selectedToolName = mapGoalToTool(state.plan.goal);

        console.log("Sales Quote Graph tool:", selectedToolName);

        return {
            ...state,
            selectedToolName
        };
    });

    graph.addNode("generalChat", async (state) => {
        return {
            ...state,
            rawToolResult: {
                text: "Hello! I am ready to help you with this Sales Quote.",
                documentId: null,
                sources: ["Conversation"]
            },
            activity: "general_chat"
        };
    });

    graph.addNode("executeTool", async (state) => {

        const selectedTool = tools.find(
            tool => tool.name === state.selectedToolName
        );

        if (!selectedTool) {
            throw new Error(`No tool found: ${state.selectedToolName}`);
        }

        const result = await selectedTool.invoke({
            prompt: state.prompt,
            salesQuoteDisplayId: state.salesQuoteDisplayId,
            memory: state.memory,
            grounding: state.grounding
        });

        let parsedResult;

        try {
            parsedResult = JSON.parse(result);
        } catch (e) {
            parsedResult = result;
        }

        return {
            ...state,
            rawToolResult: parsedResult,
            activity: state.plan.goal
        };
    });

    graph.addNode("normalizeResult", async (state) => {
        const normalizedResult = normalizeToolResult(
            state.rawToolResult,
            state.selectedToolName
        );

        return {
            ...state,
            normalizedResult
        };
    });

    graph.addNode("validateResponse", async (state) => {
        const validatedResult = validateNormalizedResult(
            state.normalizedResult,
            state.grounding
        );

        console.log("Sales Quote Graph validation:", validatedResult.validation);

        return {
            ...state,
            validatedResult
        };
    });

    graph.addEdge(START, "validateInput");
    graph.addEdge("validateInput", "loadContext");
    graph.addEdge("loadContext", "buildReasoning");
    graph.addEdge("buildReasoning", "buildGrounding");
    graph.addEdge("buildGrounding", "selectTool");
    graph.addConditionalEdges(
        "selectTool",
        (state) => {
            if (state.selectedToolName === "general_chat") {
                return "generalChat";
            }

            return "executeTool";
        },
        {
            generalChat: "generalChat",
            executeTool: "executeTool"
        }
    );
    graph.addEdge("generalChat", "normalizeResult");
    graph.addEdge("executeTool", "normalizeResult");
    graph.addEdge("normalizeResult", "validateResponse");
    graph.addEdge("validateResponse", END);

    return graph.compile();
}

module.exports = {
    createSalesQuoteGraph
};