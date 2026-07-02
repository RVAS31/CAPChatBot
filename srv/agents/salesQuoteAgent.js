const { createSalesQuoteGraph } = require("./salesQuoteGraph");

function parseJsonFromModel(content) {
    const cleaned = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    return JSON.parse(cleaned);
}

async function planSalesGoal({
    OrchestrationClient,
    destAI,
    prompts,
    prompt,
    salesQuoteDisplayId,
    sessionContext
}) {
    const plannerClient = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.salesQuoteGoalPlanner.content_system
                },
                {
                    role: "user",
                    content: prompts.salesQuoteGoalPlanner.content_user
                }
            ]
        }
    });

    const response = await plannerClient.chatCompletion({
        inputParams: {
            question: prompt,
            salesQuoteDisplayId,
            conversationContext: JSON.stringify(sessionContext || {})
        }
    });

    try {
        const parsed = parseJsonFromModel(response.getContent());

        const allowedGoals = [
            "general_chat",
            "summarize_sales_quote",
            "answer_sales_quote_question",
            "analyze_attachment",
            "extract_attachment_information",
            "draft_follow_up_email",
            "suggest_next_best_action"
        ];

        if (allowedGoals.includes(parsed.goal)) {
            return {
                goal: parsed.goal,
                confidence: parsed.confidence ?? 0,
                businessObject: "salesQuotes",
                requiresAttachment: !!parsed.requiresAttachment,
                requiresSalesQuoteData: parsed.requiresSalesQuoteData !== false,
                reason: parsed.reason || ""
            };
        }

        return {
            goal: "answer_sales_quote_question",
            confidence: 0,
            businessObject: "salesQuotes",
            requiresAttachment: false,
            requiresSalesQuoteData: true,
            reason: "Fallback goal"
        };
    } catch (e) {
        console.error("Could not parse Sales Quote goal:", response.getContent());

        return {
            goal: "answer_sales_quote_question",
            confidence: 0,
            businessObject: "salesQuotes",
            requiresAttachment: false,
            requiresSalesQuoteData: true,
            reason: "Fallback after JSON parse error"
        };
    }
}

async function runSalesQuoteAgent({
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
    uuidv4,
    _C4CApi
}) {

    const plan = await planSalesGoal({
        OrchestrationClient,
        destAI,
        prompts,
        prompt,
        salesQuoteDisplayId,
        sessionContext
    });

    console.log("Sales Quote Agent plan:", plan);

    const graph = createSalesQuoteGraph({
        OrchestrationClient,
        destAI,
        destC4C,
        prompts,
        sessionContext,
        Documents,
        DocumentAnalysis,
        JSZip,
        uuidv4,
        _C4CApi
    });

    const graphResult = await graph.invoke({
        prompt,
        salesQuoteDisplayId,
        sessionContext,
        plan,
        memory: {
            lastPrompt: sessionContext?.lastPrompt || null,
            lastResponse: sessionContext?.lastResponse || null,
            lastActivity: sessionContext?.lastActivity || null,
            lastBusinessObject: sessionContext?.lastBusinessObject || null,
            lastObjectId: sessionContext?.lastObjectId || null,
            lastDocumentId: sessionContext?.lastDocument_ID || null,
            lastSuggestedSkills: sessionContext?.lastSuggestedSkills || null
        }
    });

    return {
        activity: graphResult.activity,
        result: graphResult.normalizedResult
    };
}

module.exports = {
    runSalesQuoteAgent
};