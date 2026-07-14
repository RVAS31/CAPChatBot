// srv/skills/crmAttachmentAnalysis.js

const nextBestAction = require("./nextBestAction");
const docExtract = require("./docExtract");
const docQa = require("./docQa");
const draftEmail = require("./draftEmail");

function parseJsonFromModel(content) {
    const cleaned = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    return JSON.parse(cleaned);
}

async function decideFollowUpSkill(ctx, extractedText) {
    const {
        OrchestrationClient,
        destAI,
        prompt,
        intentJson,
        prompts,
        plan
    } = ctx;

    const goal =
        plan?.goal ||
        intentJson?.goal ||
        intentJson?.activity;

    /*
     * The Sales Quote planner has already identified the complete
     * business goal. Do not ask another model to reinterpret it.
     */
    if (goal === "send_attachment_summary_email") {
        console.log(
            "CRM attachment router: using draft_email for goal:",
            goal
        );

        return "draft_email";
    }

    const routerClient = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.crmAttachmentFollowUpRouter.content_system
                },
                {
                    role: "user",
                    content: prompts.crmAttachmentFollowUpRouter.content_user
                }
            ]
        }
    });

    const response = await routerClient.chatCompletion({
        inputParams: {
            question: prompt,
            intentJson: JSON.stringify(intentJson || {}),
            documentText: extractedText || ""
        }
    });

    try {
        const parsed = parseJsonFromModel(response.getContent());
        const skill = parsed.followUpSkill;

        if (
            skill === "doc_extract" ||
            skill === "doc_qa" ||
            skill === "draft_email" ||
            skill === "next_best_action"
        ) {
            return skill;
        }

        return "doc_qa";
    } catch (e) {
        console.error(
            "Could not parse follow-up skill decision:",
            response.getContent()
        );

        return "doc_qa";
    }
}

async function executeFollowUpSkill(ctx, extractedText, documentId) {
    const followUpSkill = await decideFollowUpSkill(
        {
            ...ctx,
            documentId,
            docText: extractedText
        },
        extractedText
    );

    console.log("CRM attachment follow-up skill:", followUpSkill);

    const skillCtx = {
        ...ctx,
        docText: extractedText,
        documentId,
        DocumentAnalysis: ctx.DocumentAnalysis
    };

    let text;

    switch (followUpSkill) {
        case "next_best_action":
            text = await nextBestAction(skillCtx);
            break;

        case "doc_extract":
            text = await docExtract(skillCtx);
            break;

        case "draft_email":
            text = await draftEmail(skillCtx);
            break;

        case "doc_qa":
        default:
            text = await docQa(skillCtx);
            break;
    }

    return {
        text,
        documentId,
        followUpSkill
    };
}

module.exports = async function crmAttachmentAnalysis(ctx) {
    const { grounding } = ctx;

    if (grounding?.attachment?.error) {
        return grounding.attachment.error;
    }

    const extractedText = grounding?.attachment?.extractedText;
    const documentId = grounding?.attachment?.internalDocumentId;

    if (!extractedText?.trim()) {
        return "No readable CRM attachment context is available.";
    }

    const result = await executeFollowUpSkill(
        ctx,
        extractedText,
        documentId
    );

    return {
        text: result.text,
        documentId: result.documentId,
        followUpSkill: result.followUpSkill
    };
};