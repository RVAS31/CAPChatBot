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
        ConversationContext, // add this
        getDestination,
        OrchestrationClient,
        prompts,
        _C4CApi,
        JSZip,
        uuidv4
    } = deps;

    srv.on("askAI", async (req) => {
        const { prompt, documentId, sessionId } = req.data;

        const destAI = await getDestination({ destinationName: "ai-core-destination-btp" });
        const destC4C = await getDestination({ destinationName: "CloudV2" });

        if (!destC4C) req.error(500, "C4C destination not found");
        if (!destAI) req.error(500, "AI Core destination not found");

        let sessionContext = null;

        if (sessionId && ConversationContext) {
            sessionContext = await SELECT.one
                .from(ConversationContext)
                .where({ sessionId });
        }

        let effectiveDocumentId = documentId;

        if (!effectiveDocumentId && sessionContext?.lastDocument_ID) {
            effectiveDocumentId = sessionContext.lastDocument_ID;
        }

        const docText = await loadDocText({
            Documents,
            documentId: effectiveDocumentId
        });

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

        if (docText && /based on that|based on it|previous document|that document/i.test(prompt)) {

            if (/email|reply|draft|write/i.test(prompt)) {
                intentJson = {
                    ...intentJson,
                    hasDocument: true,
                    activity: "draft_email",
                    businessobject: "other",
                    service: "other",
                    operation: "chat",
                    filter: {},
                    select: [],
                    payload: {}
                };
            }
        }

        console.log("SESSION:", sessionId);
        console.log("SESSION CONTEXT:", sessionContext);
        console.log("EFFECTIVE DOCUMENT:", effectiveDocumentId);
        console.log("DOC TEXT EXISTS:", !!docText);
        console.log("INTENT BEFORE ROUTE:", intentJson);

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

        const skillResult = await skills[skillName]({
            OrchestrationClient,
            destAI,
            destC4C,
            prompts,
            prompt,
            intentJson,
            docText,
            documentId: effectiveDocumentId,
            sessionContext,
            Documents,
            DocumentAnalysis,
            JSZip,
            uuidv4,
            _C4CApi
        });

        const finalAnswer =
            typeof skillResult === "string"
                ? skillResult
                : skillResult.text;

        const resultDocumentId =
            typeof skillResult === "object" && skillResult.documentId
                ? skillResult.documentId
                : effectiveDocumentId;

        const { cleanedText, isReport } = extractReportMarker(finalAnswer);

        await INSERT.into(AICollection).entries({
            prompt,
            response: cleanedText,
            isReport,
            createdAt: new Date()
        });

        if (sessionId && ConversationContext) {
            await UPSERT.into(ConversationContext).entries({
                ID: sessionContext?.ID || uuidv4(),
                sessionId,
                lastPrompt: prompt,
                lastResponse: cleanedText,
                lastDocument_ID: resultDocumentId || null,
                lastActivity: intentJson.activity || null,
                lastBusinessObject: intentJson.businessobject || null,
                lastObjectId: intentJson?.filter?.displayId || null,
                createdAt: sessionContext?.createdAt || new Date(),
                updatedAt: new Date()
            });
        }

        return cleanedText;
    });
};