module.exports = async function nextBestAction(ctx) {
    const {
        OrchestrationClient,
        destAI,
        prompt,
        docText,
        intentJson,
        prompts
    } = ctx;

    if (!docText?.trim()) {
        return "No readable document context is available. Please attach a TXT or DOCX file first.";
    }

    const client = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.nextBestAction.content_system
                },
                {
                    role: "user",
                    content: prompts.nextBestAction.content_user
                }
            ]
        }
    });

    const response = await client.chatCompletion({
        inputParams: {
            question: prompt,
            intentJson: JSON.stringify(intentJson || {}),
            documentText: docText
        }
    });

    return response.getContent();
};