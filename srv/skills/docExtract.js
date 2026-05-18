module.exports = async function docExtract(ctx) {
    const {
        OrchestrationClient,
        destAI,
        prompt,
        docText,
        documentId,
        DocumentAnalysis,
        prompts,
    } = ctx;

    if (!documentId) {
        return "No document is attached. Please attach a TXT or DOCX file first.";
    }
    if (!docText?.trim()) {
        return "The attached document has no readable text. Please attach a TXT or a text-based DOCX.";
    }

    const extractClient = new OrchestrationClient({
        destination: destAI,
        llm: { model_name: "gpt-4o" },
        templating: {
            template: [
                {
                    role: "system",
                    content: prompts.docExtract.content_system
                },
                {
                    role: "user",
                    content: prompts.docExtract.content_user
                }
            ]
        }
    });

    const extractResp = await extractClient.chatCompletion({
        inputParams: { question: prompt, documentText: docText }
    });

    const jsonText = extractResp.getContent();

    let extracted;
    try {
        extracted = JSON.parse(jsonText);
    } catch (e) {
        extracted = {
            documentType: "unknown",
            customer: { name: "", company: "", email: "", phone: "" },
            references: { orderId: "", quoteId: "", accountId: "", otherRef: "" },
            products: [],
            dates: { receivedDate: "", dueDate: "" },
            urgency: "unknown",
            requestedAction: "",
            summary: "",
            keyFacts: [],
            confidence: 0.0,
            _raw: jsonText
        };
    }

    // To persist with the analysis
    if (DocumentAnalysis) {
        await INSERT.into(DocumentAnalysis).entries({
            document_ID: documentId,
            analysis: JSON.stringify(extracted),
            createdAt: new Date(),
            model: "gpt-4o"
        });
    }

    // Return user-friendly summary
    const c = extracted.customer || {};
    const r = extracted.references || {};
    const products = Array.isArray(extracted.products) ? extracted.products : [];

    const lines = [];
    lines.push("I extracted key details from the attached document:");
    lines.push(`- Type: ${extracted.documentType || "unknown"}`);

    const custLabel = [c.company, c.name].filter(Boolean).join(" / ");
    if (custLabel) lines.push(`- Customer: ${custLabel}`);
    if (c.email) lines.push(`- Email: ${c.email}`);
    if (c.phone) lines.push(`- Phone: ${c.phone}`);

    const refParts = [];
    if (r.orderId) refParts.push(`Order: ${r.orderId}`);
    if (r.quoteId) refParts.push(`Quote: ${r.quoteId}`);
    if (r.accountId) refParts.push(`Account: ${r.accountId}`);
    if (r.otherRef) refParts.push(`Ref: ${r.otherRef}`);
    if (refParts.length) lines.push(`- References: ${refParts.join(" | ")}`);

    if (products.length) {
        lines.push("- Products:");
        products.slice(0, 5).forEach((p) => {
            const qty = [p.quantity, p.uom].filter(Boolean).join(" ");
            lines.push(`  • ${[p.name || p.id || "Item", qty].filter(Boolean).join(" — ")}`);
        });
        if (products.length > 5) lines.push(`  • (+${products.length - 5} more)`);
    }

    if (extracted.urgency) lines.push(`- Urgency: ${extracted.urgency}`);
    if (extracted.requestedAction) lines.push(`- Requested action: ${extracted.requestedAction}`);
    if (extracted.summary) lines.push(`- Summary: ${extracted.summary}`);

    lines.push("\nNext you can ask: “Draft a reply email” or “Answer questions based on the document.”");
    return lines.join("\n");
};
