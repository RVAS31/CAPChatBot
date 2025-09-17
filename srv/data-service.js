const cds = require("@sap/cds");
const { OrchestrationClient } = require("@sap-ai-sdk/orchestration");
const { getDestination } = require("@sap-cloud-sdk/connectivity");
const { checkBONames, _C4CApi } = require("./util/service-functions");
const { TYPEORCHCLIENT } = require("./util/type-operator");

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

        //To define the orchestration client to commnad the AI to extract SAP C4C queries and returns 
        //a json schema that will be used as a request 

        const orchestration = new OrchestrationClient({
            destination: destAI,
            llm: { model_name: "gpt-4o" },
            templating: {
                template: [
                    {
                        role: "system",
                        content: TYPEORCHCLIENT.content
                    },
                    { role: "user", content: "{{?question}}" }
                ]
            }
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
            intentJson = { businessObject: "Other", operation: "Chat", task: prompt };
        }

        console.log("The Intent JSON form: ", intentJson);

        // 3. Classifier/Response Generator
        const orchestrationClassifier = new OrchestrationClient({
            destination: destAI,
            llm: { model_name: "gpt-4o" },
            templating: {
                template: [
                    {
                        role: "system",
                        content: TYPEORCHCLIENT.contentClassifier
                    },
                    {
                        role: "user",
                        content: `
                        User question:
                        {{?userQuestion}}

                        C4C raw response (JSON):
                        {{?c4cData}}
                    `
                    }
                ]
            }
        });

        let finalAnswer, responseC4C;

        // 4. Decide based on intent
        if (checkBONames(intentJson.businessobject)) {

            //To get the response of the after getting the response in C4C.
            responseC4C = await _C4CApi(destC4C, intentJson);

            // To ask AI to nicely format the C4C response
            const formatted = await orchestrationClassifier.chatCompletion({
                inputParams: {
                    userQuestion: prompt,
                    c4cData: JSON.stringify(responseC4C)
                }
            });

            //To get the final answer.
            finalAnswer = formatted.getContent();

        } else {

            // General chat
            const chatResp = await orchestrationClassifier.chatCompletion({
                inputParams: { userQuestion: prompt, c4cData: "" }
            });

            //To get the final answer.
            finalAnswer = chatResp.getContent();

        }

        //6. Persist into local CAP entity
        const entry = { prompt, response: finalAnswer, createdAt: new Date() };
        await INSERT.into(AICollection).entries(entry);

        return finalAnswer; // <--- return plain text (matches cds action returns String)
        //return "Here the response text should be displayed"
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
