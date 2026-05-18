export function route(intentJson, ctx) {

    const activity = (intentJson.activity || "").toLowerCase();
    const hasDocument = !!ctx?.hasDocument;

    //To document skill base
    if (hasDocument) {
        
        if (activity === "next_best_action") {
            return "nextBestAction";
        }

        if (activity === "doc_extract") {
            return "docExtract";
        }

        if (activity === "doc_qa" || activity === "doc_summary") {
            return "docQa";
        }

        if (activity === "draft_email") {
            return "draftEmail";
        }
    }

    //To head CRM path
    const bo = intentJson.businessobject || intentJson.businessObject;
    if (bo && bo !== "other" && bo !== "Other") {
        return "crmQuery";
    }

    //To fallback
    return "generalChat";
}
