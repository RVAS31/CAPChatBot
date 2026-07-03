const { StateGraph, END, START } = require("@langchain/langgraph");
const { createSalesQuoteTools } = require("../tools/salesQuoteTools");

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

function normalizeToolResult(toolResult) {
    if (typeof toolResult === "string") {
        return {
            text: toolResult,
            documentId: null,
            sources: ["Conversation"]
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
            plan: null,
            selectedToolName: null,
            rawToolResult: null,
            normalizedResult: null,
            activity: null
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
            memory: state.memory
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
        const normalizedResult = normalizeToolResult(state.rawToolResult);

        return {
            ...state,
            normalizedResult
        };
    });

    graph.addEdge(START, "validateInput");
    graph.addEdge("validateInput", "selectTool");
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
    graph.addEdge("normalizeResult", END);

    return graph.compile();
}

module.exports = {
    createSalesQuoteGraph
};