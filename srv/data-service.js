const cds = require("@sap/cds");
const { OrchestrationClient } = require("@sap-ai-sdk/orchestration");
const { getDestination } = require("@sap-cloud-sdk/connectivity");
const { getBusinessObjectNames, _fetchC4C, _summarize } = require("./util/service-functions");

module.exports = cds.service.impl(async function () {
    const { AICollection } = this.entities;

    this.on("askAI", async (req) => {
        const { prompt } = req.data;

        // Get destination bound to AI Core as well as destC4C.
        const destAI = await getDestination({ destinationName: "ai-core-destination-btp" });
        const destC4C = await getDestination({ destinationName: "CloudV2" });

        //To verify if they are available
        if (!destC4C) req.error(500, "C4C destination not found");

        if (!destAI) {
            req.error(500, "AI Core destination not found");
        }

        //To define the orchestration client to intent to get both the task and BO that 
        //user wants to work on.
        const orchestration = new OrchestrationClient({
            destination: destAI,
            llm: {
                model_name: "gpt-4o", // or whatever model you provisioned in AI Core
            },
            templating: {
                template: [
                    {
                        role: "system",
                        content: `
                            You are an intent classifier for SAP C4C queries. 
                            Respond only with JSON:
                            { "intent": "SalesQuotes" } 
                            { "intent": "Accounts" } 
                            { "intent": "Contacts" } 
                            { "intent": "chat" }`
                    },
                    { role: "user", content: "{{?question}}" }
                ],
            },
        });

        // 3. To detect intent
        const inteResponse = await orchestration.chatCompletion({
            inputParams: {
                question: prompt, // <--- use the user prompt
            },
        });

        let intentJson;
        try {
            intentJson = JSON.parse(inteResponse.getContent());
        } catch (e) {
            intentJson = { intent: "chat" };
        }

        //To define the orchestration client to classify according that it was given
        const orchestrationClassifier = new OrchestrationClient({
            destination: destAI,
            llm: { model_name: "gpt-4o" },
            templating: {
                template: [
                    { role: "system", content: "You are an intent classifier for SAP C4C queries. Output JSON only…" },
                    { role: "user", content: "{{?question}}" }
                ]
            }
        });
        let responseText;

        // 4. Decide based on intent
        if (intentJson.intent === "SalesQuotes") {
            responseC4C = await _fetchC4C(destC4C, 'sales-quote-service/salesQuotes');

            //If everthing returns as the expected endpoints 
            //5. Return a resport of the first 5 
            responseText = await _summarize(orchestrationClassifier, responseC4C, 'items');

        } else if (intentJson.intent === "Accounts") {
            responseC4C = await _fetchC4C(destC4C, 'account-service/accounts');

            //If everthing returns as the expected endpoints 
            //5. Return a resport of the first 5 
            responseText = await _summarize(orchestrationClassifier, responseC4C, 'Accounts');

        } else if (intentJson.intent === "Contacts") {
            responseC4C = await _fetchC4C(destC4C, 'contact-person-service/contactPersons');

            //If everthing returns as the expected endpoints 
            //5. Return a resport of the first 5 
            responseText = await _summarize(orchestrationClassifier, responseC4C, 'Contacts');

        } else {
            // fallback = general chat
            const chatResp = await orchestration.chatCompletion({
                inputParams: { question: prompt }
            });
            responseText = chatResp.getContent();
        }

        //6. Persist into local CAP entity
        //const entry = { prompt, response: responseText, createdAt: new Date() };
        //await INSERT.into(AICollection).entries(entry);

        return responseText; // <--- return plain text (matches cds action returns String)
    });

    this.on("c4cConnection", async (req) => {

        const destC4C = await getDestination({ destinationName: "CloudV2" });

        console.log("destC4C", destC4C)

        if (!destC4C) req.error(500, "C4C destination not found");

        // Build Basic Auth header
        const authHeader = "Basic " + Buffer.from(`${destC4C.username}:${destC4C.password}`).toString("base64");

        // 4b. Call C4C OData service
        const accountRes = await axios.get("/sap/c4c/api/v1/account-service/accounts", {
            baseURL: destC4C.url,
            headers: { Authorization: authHeader }
        });

        console.log("here the account response", accountRes)

        return "This is a test"
    });
});
