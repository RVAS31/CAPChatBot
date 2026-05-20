const { loadDocText } = require("../utils/docContext");
const { extractReportMarker } = require("../utils/reportMarker");
const { route } = require("../agents/router");
const { normalizeIntentFromPrompt } = require("../agents/intentNormalizer");

const crmQuery = require("../skills/crmQuery");
const generalChat = require("../skills/generalChat");
const docQa = require("../skills/docQa");
const draftEmail = require("../skills/draftEmail");
const docExtract = require("../skills/docExtract");
const nextBestAction = require("../skills/nextBestAction");
const crmAttachmentAnalysis = require("../skills/crmAttachmentAnalysis"); 


module.exports = function registerAskAI(srv, deps) {
    const {
        AICollection,
        Documents,
        DocumentAnalysis,
        getDestination,
        OrchestrationClient,
        prompts,
        _C4CApi,
        JSZip,      
        uuidv4      
    } = deps;

    srv.on("askAI", async (req) => {
        const { prompt, documentId } = req.data;

        const destAI = await getDestination({ destinationName: "ai-core-destination-btp" });
        const destC4C = await getDestination({ destinationName: "CloudV2" });

        if (!destC4C) req.error(500, "C4C destination not found");
        if (!destAI) req.error(500, "AI Core destination not found");

        const docText = await loadDocText({ Documents, documentId });

        const orchestration = new OrchestrationClient({
            destination: destAI,
            llm: { model_name: "gpt-4o" },
            templating: {
                template: [
                    { role: "system", content: prompts.askAI.content_system },
                    { role: "user", content: prompts.askAI.content_user }
                ]
            }
        });

        const inteResponse = await orchestration.chatCompletion({
            inputParams: { question: prompt, documentText: docText || "" }
        });

        let intentJson;
        try {
            intentJson = JSON.parse(inteResponse.getContent());
        } catch (e) {
            intentJson = {
                hasDocument: !!docText,
                activity: "chat",
                confidence: 0.3,
                businessobject: "other",
                service: "other",
                operation: "chat",
                task: prompt,
                select: [],
                filter: {},
                payload: {}
            };
        }

        intentJson = normalizeIntentFromPrompt(prompt, intentJson);

        const skillName = route(intentJson, { hasDocument: !!docText });

        console.log("Routed to skill:", skillName, "with intent:", intentJson);

        const skills = {
            crmQuery,
            generalChat,
            docQa,
            draftEmail,
            docExtract,
            nextBestAction,
            crmAttachmentAnalysis 
        };

        const finalAnswer = await skills[skillName]({
            OrchestrationClient,
            destAI,
            destC4C,
            prompts,
            prompt,
            intentJson,
            docText,
            documentId,
            Documents,         
            DocumentAnalysis,
            JSZip,             
            uuidv4,             
            _C4CApi
        });

        const { cleanedText, isReport } = extractReportMarker(finalAnswer);

        await INSERT.into(AICollection).entries({
            prompt,
            response: cleanedText,
            isReport,
            createdAt: new Date()
        });

        return cleanedText;
    });
};