using aimodel as ai from '../db/data-model';

service AIService {
    entity AICollection as projection on ai.Prompts;

    // Use action (not function) for your use case
    action askAI(prompt: String) returns String;

    // Use action to get the AI response and returns the outcome 
    action getResponseById(ID : UUID) returns String;

    // Use action (not function) for your use case
    action c4cConnection() returns String;

}