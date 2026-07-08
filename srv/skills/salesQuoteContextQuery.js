module.exports = async function salesQuoteContextQuery(ctx) {
    const {
        OrchestrationClient,
        destAI,
        prompts,
        prompt,
        salesQuoteDisplayId,
        grounding
    } = ctx;

    const salesQuote = grounding?.salesQuote;

    if (!salesQuote) {
        return `I could not find Sales Quote ${salesQuoteDisplayId}.`;
    }

    const client = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.salesQuoteContextQuery.content_system
                },
                {
                    role: "user",
                    content: prompts.salesQuoteContextQuery.content_user
                }
            ]
        }
    });

    const response = await client.chatCompletion({
        inputParams: {
            question: prompt,
            salesQuoteData: JSON.stringify(salesQuote)
        }
    });

    return response.getContent();
};