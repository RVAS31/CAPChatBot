// srv/skills/docQa.js
module.exports = async function docQa(ctx) {
    const { OrchestrationClient, destAI, prompt, docText, prompts } = ctx;

    const docClient = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.docQa.content_system
                },
                {
                    role: "user",
                    content: prompts.docQa.content_user
                }
            ]
        }
    });

    const resp = await docClient.chatCompletion({
        inputParams: { question: prompt, documentText: docText || "" }
    });

    return resp.getContent();
};
