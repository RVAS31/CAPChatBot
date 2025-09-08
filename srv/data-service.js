const cds = require("@sap/cds");
const { OrchestrationClient } = require("@sap-ai-sdk/orchestration");
const { getDestination } = require("@sap-cloud-sdk/connectivity");

module.exports = cds.service.impl(async function () {
    const { AICollection } = this.entities;

    this.on("askAI", async (req) => {
        const { prompt } = req.data;

        // Get destination bound to AI Core
        const dest = await getDestination({ destinationName: "ai-core-destination-btp" });

        if (!dest) {
            req.error(500, "AI Core destination not found");
        }

        // Create orchestration client
        const orchestration = new OrchestrationClient({
            destination: dest,
            llm: {
                model_name: "gpt-4o", // or whatever model you provisioned in AI Core
            },
            templating: {
                template: [
                    { role: "user", content: "Answer the question: {{?question}}" }
                ],
            },
        });

        // Call AI Core orchestration
        const response = await orchestration.chatCompletion({
            inputParams: {
                question: prompt, // <--- use the user prompt
            },
        });

        const responseText = response.getContent();

        // Persist into local CAP entity
        const entry = { prompt, response: responseText, createdAt: new Date() };
        await INSERT.into(AICollection).entries(entry);

        return responseText; // <--- return plain text (matches cds action returns String)
    });
});
