const cds = require("@sap/cds");

// your existing dependencies (keep your paths/imports)
const { getDestination } = require("@sap-cloud-sdk/connectivity");
const { OrchestrationClient } = require("@sap-ai-sdk/orchestration");
const JSZip = require("jszip");
const { v4: uuidv4 } = require("uuid");

const { prompts } = require("./utils/prompting");
const { _C4CApi, checkBONames } = require("./utils/service-functions");

const registerAskAI = require("./handlers/askAI");
const registerUploadTextDocument = require("./handlers/uploadTextDocument");
const registerGetResponseById = require("./handlers/getResponseById");

module.exports = cds.service.impl(function () {

    const { AICollection, Documents, DocumentAnalysis, ConversationContext } = this.entities;

    // Register handlers
    registerAskAI(this, {
        AICollection,
        Documents,
        DocumentAnalysis,
        ConversationContext,
        getDestination,
        OrchestrationClient,
        prompts,
        _C4CApi,
        checkBONames,
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
