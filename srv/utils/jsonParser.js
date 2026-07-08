function parseJsonFromModel(content) {
    const cleaned = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    return JSON.parse(cleaned);
}

module.exports = {
    parseJsonFromModel
};