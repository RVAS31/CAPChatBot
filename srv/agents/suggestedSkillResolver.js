function resolveSuggestedSkill(prompt, sessionContext) {
    const text = (prompt || "").toLowerCase();

    if (!sessionContext?.lastSuggestedSkills) {
        return null;
    }

    let suggestions = [];
    try {
        suggestions = JSON.parse(sessionContext.lastSuggestedSkills);
    } catch (e) {
        return null;
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return null;
    }

    const optionMatch =
        text.match(/option\s*(\d+)/i) ||
        text.match(/number\s*(\d+)/i) ||
        text.match(/^(\d+)$/);

    if (optionMatch) {
        const index = Number(optionMatch[1]) - 1;
        return suggestions[index] || null;
    }

    if (text.includes("email") || text.includes("reply")) {
        return suggestions.find(s => s.skill === "draftEmail") || null;
    }

    if (text.includes("next") || text.includes("recommend")) {
        return suggestions.find(s => s.skill === "nextBestAction") || null;
    }

    if (text.includes("extract") || text.includes("fields")) {
        return suggestions.find(s => s.skill === "docExtract") || null;
    }

    return null;
}

module.exports = {
    resolveSuggestedSkill
};