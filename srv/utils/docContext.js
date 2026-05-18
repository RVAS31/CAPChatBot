module.exports.loadDocText = async function loadDocText({ Documents, documentId }) {
    if (!documentId) return "";

    const doc = await SELECT.one.from(Documents).where({ ID: documentId });
    if (!doc?.extractedText) return "";

    // cap to keep prompts safe
    return doc.extractedText.slice(0, 15000);
};
