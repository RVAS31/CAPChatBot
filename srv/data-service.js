const cds = require("@sap/cds");

const { getDestination } = require("@sap-cloud-sdk/connectivity");
const { OrchestrationClient } = require("@sap-ai-sdk/orchestration");
const JSZip = require("jszip");
const { v4: uuidv4 } = require("uuid");

const { prompts } = require("./utils/prompting");

const registerUploadTextDocument =
    require("./handlers/uploadTextDocument");

const registerGetResponseById =
    require("./handlers/getResponseById");

const registerAskSalesQuoteAgent =
    require("./handlers/askSalesQuoteAgent");

const registerSendSalesQuoteSummaryEmail =
    require("./handlers/sendSalesQuoteSummaryEmail");

module.exports = cds.service.impl(function () {
    const {
        AICollection,
        Documents,
        DocumentAnalysis,
        ConversationContext
    } = this.entities;

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

    registerSendSalesQuoteSummaryEmail(this, {
        AICollection,
        ConversationContext,
        getDestination,
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