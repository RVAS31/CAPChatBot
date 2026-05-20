function normalizeIntentFromPrompt(prompt, intentJson = {}) {
    const text = (prompt || "").toLowerCase();

    const mentionsAttachment =
        text.includes("attachment") ||
        text.includes("file") ||
        text.includes("document");

    const mentionsSalesQuote =
        text.includes("sales quote") ||
        text.includes("quote");

    const displayIdMatch =
        text.match(/displayid\s*(?:=|is|:)?\s*(\d+)/i) ||
        text.match(/sales quote\s+(\d+)/i) ||
        text.match(/quote\s+(\d+)/i);

    if (mentionsAttachment && mentionsSalesQuote && displayIdMatch) {
        return {
            ...intentJson,
            hasDocument: false,
            activity: "crm_attachment_analysis",
            confidence: Math.max(intentJson.confidence || 0, 0.95),
            businessobject: "salesQuotes",
            service: "sales-quote-service",
            operation: "read",
            task: intentJson.task || `analyze attachment of sales quote ${displayIdMatch[1]}`,
            filter: {
                ...(intentJson.filter || {}),
                displayId: displayIdMatch[1]
            },
            select: intentJson.select || [],
            payload: intentJson.payload || {}
        };
    }

    return intentJson;
}

module.exports = {
    normalizeIntentFromPrompt
};