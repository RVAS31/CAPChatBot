// srv/utils/documentExtraction.js

/**
 * Extracts readable text from TXT or DOCX buffers.
 *
 * Reused by:
 * - uploadTextDocument.js
 * - crmAttachmentAnalysis.js
 *
 * @param {Buffer} buffer
 * @param {string} fileName
 * @param {string} mimeType
 * @param {*} JSZip
 * @returns {Promise<string>}
 */
async function extractTextFromBuffer(buffer, fileName, mimeType, JSZip) {

    if (!buffer) {
        throw new Error("No file buffer provided.");
    }

    const lowerFileName = (fileName || "").toLowerCase();
    const safeMimeType = mimeType || "";

    // =========================
    // TXT
    // =========================
    if (
        lowerFileName.endsWith(".txt") ||
        safeMimeType === "text/plain"
    ) {

        const text = buffer.toString("utf8");

        return text?.trim() || "";
    }

    // =========================
    // DOCX
    // =========================
    if (
        lowerFileName.endsWith(".docx") ||
        safeMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {

        const zip = await JSZip.loadAsync(buffer);

        const documentXmlFile = zip.file("word/document.xml");

        if (!documentXmlFile) {
            throw new Error("Invalid DOCX file: word/document.xml not found.");
        }

        const documentXml = await documentXmlFile.async("string");

        // Basic XML cleanup
        const extractedText = documentXml

            // tabs
            .replace(/<w:tab\/>/g, "\t")

            // paragraph breaks
            .replace(/<\/w:p>/g, "\n")

            // line breaks
            .replace(/<w:br\/>/g, "\n")

            // remove all XML tags
            .replace(/<[^>]+>/g, "")

            // normalize multiple empty lines
            .replace(/\n\s*\n/g, "\n\n")

            .trim();

        return extractedText;
    }

    // =========================
    // Unsupported
    // =========================
    throw new Error(
        `Unsupported file type. File: ${fileName}, MIME type: ${mimeType}`
    );
}

module.exports = {
    extractTextFromBuffer
};