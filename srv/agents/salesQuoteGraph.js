const { StateGraph, END, START } = require("@langchain/langgraph");
const { createSalesQuoteTools } = require("../tools/salesQuoteTools");
const { buildSalesQuoteGrounding } = require("../grounding/salesQuoteGrounding");
const { parseJsonFromModel } = require("../utils/jsonParser");

function mapGoalToTool(goal) {
    switch (goal) {
        case "general_chat":
            return "general_chat";

        case "analyze_attachment":
        case "extract_attachment_information":
        case "draft_follow_up_email":
        case "send_attachment_summary_email":
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

async function buildReasoningWithLLM(state, baseCtx) {
    const reasonerClient = new baseCtx.OrchestrationClient({
        destination: baseCtx.destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: baseCtx.prompts.salesQuoteReasoner.content_system
                },
                {
                    role: "user",
                    content: baseCtx.prompts.salesQuoteReasoner.content_user
                }
            ]
        }
    });

    const response = await reasonerClient.chatCompletion({
        inputParams: {
            question: state.prompt,
            salesQuoteDisplayId: state.salesQuoteDisplayId,
            plan: JSON.stringify(state.plan || {}),
            loadedContext: JSON.stringify(state.loadedContext || {}),
            memory: JSON.stringify(state.memory || {})
        }
    });

    try {
        const parsed = parseJsonFromModel(response.getContent());

        const llmNeedsAttachment = !!parsed.needsAttachment;
        const llmNeedsSalesQuoteData = !!parsed.needsSalesQuoteData;

        const reasoning = {
            needsAttachment: llmNeedsAttachment,

            needsSalesQuoteData:
                llmNeedsSalesQuoteData || llmNeedsAttachment,

            reuseAttachment:
                llmNeedsAttachment &&
                !!state.loadedContext?.hasMemoryDocument &&
                !!state.loadedContext?.lastDocumentId,

            loadAttachmentFromCRM:
                llmNeedsAttachment &&
                !(
                    !!state.loadedContext?.hasMemoryDocument &&
                    !!state.loadedContext?.lastDocumentId
                ),

            askClarification: !!parsed.askClarification,
            clarificationQuestion: parsed.clarificationQuestion || "",
            reason: parsed.reason || ""
        };

        return reasoning;

    } catch (e) {
        console.error("Could not parse Sales Quote reasoning:", response.getContent());

        const fallbackNeedsAttachment = !!state.plan?.requiresAttachment;

        return {
            needsAttachment: fallbackNeedsAttachment,
            needsSalesQuoteData:
                state.plan?.requiresSalesQuoteData !== false || fallbackNeedsAttachment,
            reuseAttachment:
                fallbackNeedsAttachment &&
                !!state.loadedContext?.hasMemoryDocument &&
                !!state.loadedContext?.lastDocumentId,
            loadAttachmentFromCRM:
                fallbackNeedsAttachment &&
                !(
                    !!state.loadedContext?.hasMemoryDocument &&
                    !!state.loadedContext?.lastDocumentId
                ),
            askClarification: false,
            clarificationQuestion: "",
            reason: "Fallback reasoning"
        };
    }
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
        const reasoning = await buildReasoningWithLLM(state, baseCtx);

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
        let selectedToolName;

        if (state.reasoning?.needsAttachment) {
            selectedToolName = "crm_attachment_analysis";
        } else {
            selectedToolName = mapGoalToTool(state.plan.goal);
        }

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
            grounding: state.grounding,
            plan: state.plan
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