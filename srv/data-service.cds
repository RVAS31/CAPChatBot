using aimodel as ai from '../db/data-model';

service AIService {
    entity AICollection        as projection on ai.Prompts;
    entity Documents           as projection on ai.Documents;
    entity DocumentAnalysis    as projection on ai.DocumentAnalysis;
    entity ConversationContext as projection on ai.ConversationContext;

    action askAI(prompt: String,
                 documentId: UUID,
                 sessionId: String)                             returns String;

    action getResponseById(ID: UUID)                            returns String;

    action uploadTextDocument(fileName: String,
                              mimeType: String,
                              contentBase64: String)            returns UUID;

    action analyzeDocument(documentId: UUID)                    returns String;

    action c4cConnection()                                      returns String;

    action askSalesQuoteAgent(prompt: String,
                              salesQuoteDisplayId: String,
                              sessionId: String)                returns String;

    action sendSalesQuoteSummaryEmail(sessionId: String,
                                      salesQuoteDisplayId: String,
                                      confirmationText: String) returns String;
}
