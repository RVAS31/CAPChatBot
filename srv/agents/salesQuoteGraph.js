const { StateGraph, END, START } = require("@langchain/langgraph");
const { createSalesQuoteTools } = require("../tools/salesQuoteTools");

function mapGoalToTool(goal) {
    switch (goal) {
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

function createSalesQuoteGraph(baseCtx) {
    const tools = createSalesQuoteTools(baseCtx);

    const graph = new StateGraph({
        channels: {
            prompt: null,
            salesQuoteDisplayId: null,
            sessionContext: null,
            plan: null,
            selectedToolName: null,
            toolResult: null,
            activity: null
        }
    });

    graph.addNode("selectTool", async (state) => {
        const selectedToolName = mapGoalToTool(state.plan.goal);

        console.log("Sales Quote Graph tool:", selectedToolName);

        return {
            ...state,
            selectedToolName
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
            salesQuoteDisplayId: state.salesQuoteDisplayId
        });

        let parsedResult;

        try {
            parsedResult = JSON.parse(result);
        } catch (e) {
            parsedResult = result;
        }

        return {
            ...state,
            toolResult: parsedResult,
            activity: state.plan.goal
        };
    });

    graph.addEdge(START, "selectTool");
    graph.addEdge("selectTool", "executeTool");
    graph.addEdge("executeTool", END);

    return graph.compile();
}

module.exports = {
    createSalesQuoteGraph
};