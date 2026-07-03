const cds = require("@sap/cds");

// your existing dependencies (keep your paths/imports)
const { getDestination } = require("@sap-cloud-sdk/connectivity");
const { OrchestrationClient } = require("@sap-ai-sdk/orchestration");
const JSZip = require("jszip");
const { v4: uuidv4 } = require("uuid");

const { prompts } = require("./utils/prompting");

const registerUploadTextDocument = require("./handlers/uploadTextDocument");
const registerGetResponseById = require("./handlers/getResponseById");
const registerAskSalesQuoteAgent = require("./handlers/askSalesQuoteAgent");

module.exports = cds.service.impl(function () {

    const { AICollection, Documents, DocumentAnalysis, ConversationContext } = this.entities;

    registerAskSalesQuoteAgent(this, {
        AICollection,
        Documents,
        DocumentAnalysis,
        ConversationContext,
        getDestination,
        OrchestrationClient,
        prompts,
        JSZip,
        uuidv4
    });

    registerUploadTextDocument(this, {
        Documents,
        JSZip,
        uuidv4
    });

    registerGetResponseById(this, {
        AICollection
    });
});
