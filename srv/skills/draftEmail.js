// srv/skills/draftEmail.js
module.exports = async function draftEmail(ctx) {
    const { OrchestrationClient, destAI, prompt, docText, prompts } = ctx;

    const emailClient = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.draftEmail.content_system
                },
                {
                    role: "user",
                    content: prompts.draftEmail.content_user
                }
            ]
        }
    });

    const resp = await emailClient.chatCompletion({
        inputParams: { question: prompt, documentText: docText || "" }
    });

    return resp.getContent();
};
