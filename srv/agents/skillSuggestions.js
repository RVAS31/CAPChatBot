function getDefaultDocumentSuggestions() {
    return [
        {
            label: "Draft customer email",
            skill: "draftEmail",
            prompt: "Draft a professional customer email based on the previous document."
        },
        {
            label: "Recommend next best actions",
            skill: "nextBestAction",
            prompt: "Recommend next best actions based on the previous document."
        },
        {
            label: "Extract structured fields",
            skill: "docExtract",
            prompt: "Extract the key CRM-relevant fields from the previous document."
        }
    ];
}

function formatSuggestions(suggestions = []) {
    if (!suggestions.length) return "";

    return "\n\nSuggested next steps:\n" + suggestions
        .map((s, i) => `${i + 1}. ${s.label}`)
        .join("\n");
}

module.exports = {
    getDefaultDocumentSuggestions,
    formatSuggestions
};