using aimodel as ai from '../db/data-model';

service AIService {
    entity AICollection as projection on ai.Prompts;

    // Use action (not function) for your use case
    action askAI(prompt: String) returns String;
}