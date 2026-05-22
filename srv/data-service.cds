using aimodel as ai from '../db/data-model';

service AIService {
    entity AICollection        as projection on ai.Prompts;

    entity Documents           as projection on ai.Documents;

    entity DocumentAnalysis    as projection on ai.DocumentAnalysis;

    entity ConversationContext as projection on ai.ConversationContext;

    // Use action (not function) for your use case
    action askAI(prompt: String,
                 documentId: UUID,
                 sessionId: String)                  returns String;

    // Use action to get the AI response and returns the outcome
    action getResponseById(ID: UUID)                 returns String;

    // Use action to upload the text document
    action uploadTextDocument(fileName: String,
                              mimeType: String,
                              contentBase64: String) returns UUID;

    // Use the action to analyze the document
    action analyzeDocument(documentId: UUID)         returns String;


    // Use action (not function) for your use case
    action c4cConnection()                           returns String;

}
