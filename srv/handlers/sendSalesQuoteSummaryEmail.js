// srv/handlers/sendSalesQuoteSummaryEmail.js

const { sendEmail } = require("../actions/sendEmail");

const {
    readSalesQuoteByDisplayId
} = require("../utils/crmAttachment");

const {
    buildC4CAuthHeader
} = require("../utils/service-functions");

/**
 * Extracts Subject and Body from the email draft saved in
 * ConversationContext.lastResponse.
 */
function parseEmailDraft(draftText) {
    const text = String(draftText || "").trim();

    const subjectMatch = text.match(/^Subject:\s*(.+)$/im);
    const bodyMatch = text.match(
        /^Body:\s*([\s\S]*?)(?=\nThe email has not been sent yet\.|\nPlease confirm|$)/im
    );

    const subject = subjectMatch?.[1]?.trim() || "";
    const body = bodyMatch?.[1]?.trim() || "";

    if (!subject) {
        throw new Error("The pending email draft does not contain a subject.");
    }

    if (!body) {
        throw new Error("The pending email draft does not contain a body.");
    }

    return {
        subject,
        body
    };
}

module.exports = function registerSendSalesQuoteSummaryEmail(srv, deps) {
    const {
        AICollection,
        ConversationContext,
        getDestination,
        uuidv4
    } = deps;

    srv.on("sendSalesQuoteSummaryEmail", async (req) => {
        const {
            sessionId,
            salesQuoteDisplayId,
            confirmationText
        } = req.data;

        const confirmationPrompt =
            String(confirmationText || "send it").trim();

        if (!sessionId) {
            return req.reject(400, "Session ID is required.");
        }

        if (!salesQuoteDisplayId) {
            return req.reject(
                400,
                "Sales Quote displayId is required."
            );
        }

        /*
         * Load the pending email draft.
         */
        const sessionContext = await SELECT.one
            .from(ConversationContext)
            .where({ sessionId });

        if (!sessionContext) {
            return req.reject(
                404,
                "No conversation context was found for this session."
            );
        }

        /*
         * Only the specific attachment-summary workflow may trigger
         * this email action.
         */
        if (
            sessionContext.lastActivity !==
            "send_attachment_summary_email"
        ) {
            return req.reject(
                409,
                "There is no attachment summary email waiting for confirmation."
            );
        }

        if (
            String(sessionContext.lastObjectId) !==
            String(salesQuoteDisplayId)
        ) {
            return req.reject(
                409,
                "The pending email belongs to a different Sales Quote."
            );
        }

        const {
            subject,
            body
        } = parseEmailDraft(sessionContext.lastResponse);

        /*
         * Retrieve the Sales Quote again instead of trusting the
         * recipient shown in the generated response.
         */
        const destC4C = await getDestination({
            destinationName: "CloudV2"
        });

        if (!destC4C) {
            return req.reject(
                500,
                "C4C destination was not found."
            );
        }

        const authHeader = buildC4CAuthHeader(destC4C);

        const salesQuote = await readSalesQuoteByDisplayId(
            destC4C,
            authHeader,
            salesQuoteDisplayId
        );

        if (!salesQuote) {
            return req.reject(
                404,
                `Sales Quote ${salesQuoteDisplayId} was not found.`
            );
        }

        const recipient =
            salesQuote.salesEmployee?.email ||
            salesQuote.owner?.email;

        const recipientName =
            salesQuote.salesEmployee?.partyName ||
            salesQuote.owner?.partyName ||
            "Sales Employee";

        if (!recipient) {
            return req.reject(
                422,
                "No email address was found for the Sales Employee or Sales Quote Owner."
            );
        }

        /*
         * Reserve the pending draft before performing the external
         * side effect. This helps prevent duplicate sends.
         */
        const updatedRows = await UPDATE(ConversationContext)
            .set({
                lastActivity: "attachment_summary_email_sending",
                updatedAt: new Date()
            })
            .where({
                sessionId,
                lastActivity: "send_attachment_summary_email"
            });

        if (!updatedRows) {
            return req.reject(
                409,
                "This email is no longer waiting for confirmation."
            );
        }

        let sendResult;

        try {
            sendResult = await sendEmail({
                to: recipient,
                subject,
                body
            });
        } catch (error) {
            /*
             * Restore the pending state so the user can retry after
             * the SMTP problem has been corrected.
             */
            await UPDATE(ConversationContext)
                .set({
                    lastActivity: "send_attachment_summary_email",
                    updatedAt: new Date()
                })
                .where({
                    sessionId,
                    lastActivity: "attachment_summary_email_sending"
                });

            console.error("Could not send Sales Quote email:", error);

            return req.reject(
                502,
                `The email could not be sent: ${error.message}`
            );
        }

        const confirmationMessage = [
            "Email sent successfully.",
            "",
            `Recipient: ${recipientName} <${recipient}>`,
            `Subject: ${subject}`
        ].join("\n");

        /*
         * Save the confirmation so it appears in the existing chat
         * history retrieved from AICollection.
         */
        await INSERT.into(AICollection).entries({
            ID: uuidv4(),
            prompt: "send it",
            response: confirmationMessage,
            isReport: false,
            createdAt: new Date(),
            document_ID: sessionContext.lastDocument_ID || null,
            sessionId,
            businessObject: "salesQuotes",
            objectId: salesQuoteDisplayId
        });

        await UPDATE(ConversationContext)
            .set({
                lastPrompt: confirmationPrompt,
                lastResponse: confirmationMessage,
                lastActivity: "attachment_summary_email_sent",
                lastBusinessObject: "salesQuotes",
                lastObjectId: salesQuoteDisplayId,
                updatedAt: new Date(),
                lastSuggestedSkills: JSON.stringify({
                    activity: "attachment_summary_email_sent",
                    recipient,
                    messageId: sendResult.messageId
                })
            })
            .where({ sessionId });

        return confirmationMessage;
    });
};