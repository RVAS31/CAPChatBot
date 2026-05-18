module.exports.extractReportMarker = function extractReportMarker(text) {
    let cleanedText = text || "";
    const reportPattern = /\[REPORT\]\s*$/;
    let isReport = false;

    if (reportPattern.test(cleanedText)) {
        isReport = true;
        cleanedText = cleanedText.replace(reportPattern, "").trim();
    }

    return { cleanedText, isReport };
};
