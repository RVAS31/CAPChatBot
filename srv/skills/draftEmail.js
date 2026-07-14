// srv/skills/draftEmail.js

module.exports = async function draftEmail(ctx) {
    const {
        OrchestrationClient,
        destAI,
        prompt,
        docText,
        prompts,
        plan,
        intentJson,
        grounding
    } = ctx;

    const goal =
        plan?.goal ||
        intentJson?.goal ||
        intentJson?.activity ||
        "draft_follow_up_email";

    const salesQuote = grounding?.salesQuote || {};

    const salesEmployee =
        salesQuote.salesEmployee ||
        salesQuote.owner ||
        {};

    const isAttachmentSummaryEmail =
        goal === "send_attachment_summary_email";

    /*
     * For the attachment-summary workflow, the recipient must be
     * the responsible Sales Employee.
     */
    const recipientName = isAttachmentSummaryEmail
        ? salesEmployee.partyName || ""
        : "";

    const recipientEmail = isAttachmentSummaryEmail
        ? salesEmployee.email || ""
        : "";

    if (isAttachmentSummaryEmail && !recipientEmail) {
        return [
            "I summarized the attachment, but I could not prepare the email for sending.",
            "",
            "No email address was found for the Sales Employee or Sales Quote Owner."
        ].join("\n");
    }

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

    const response = await emailClient.chatCompletion({
        inputParams: {
            question: prompt,
            documentText: docText || "",
            emailGoal: goal,
            recipientName,
            recipientEmail
        }
    });

    const generatedDraft = response.getContent().trim();

    /*
     * Normal email-drafting requests keep the previous behavior.
     */
    if (!isAttachmentSummaryEmail) {
        return generatedDraft;
    }

    /*
     * Recipient and confirmation are added deterministically instead
     * of relying on the model to produce them.
     */
    return [
        `To: ${recipientName || "Sales Employee"} <${recipientEmail}>`,
        generatedDraft,
        "",
        "The email has not been sent yet.",
        'Please confirm by replying with "send it", "yes", "go ahead", or "please send".'
    ].join("\n");
};