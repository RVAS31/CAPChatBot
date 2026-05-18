// srv/skills/crmQuery.js
const { OrchestrationClient } = require("@sap-ai-sdk/orchestration"); // adjust import

module.exports = async function crmQuery(ctx) {
    const { prompt, intentJson, destAI, destC4C, prompts } = ctx;

    const orchestrationClassifier = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                { role: "system", content: prompts.crmQuery.content_system },
                {
                    role: "user",
                    content: prompts.crmQuery.content_user
                }
            ]
        }
    });

    const responseC4C = await ctx._C4CApi(destC4C, intentJson);

    const formatted = await orchestrationClassifier.chatCompletion({
        inputParams: {
            userQuestion: prompt,
            c4cData: JSON.stringify(responseC4C)
        }
    });

    return formatted.getContent();
};
