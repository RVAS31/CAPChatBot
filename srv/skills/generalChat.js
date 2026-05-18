// srv/skills/generalChat.js
module.exports = async function generalChat(ctx) {
  const { OrchestrationClient, destAI, prompt, prompts } = ctx;

  const chatClient = new OrchestrationClient({
    destination: destAI,
    llm: { model_name: "gpt-4o" },
    templating: {
      template: [
        {
          role: "system", content: prompts.generalChat.content_system
        },
        {
          role: "user",
          content: prompts.generalChat.content_user
        }
      ]
    }
  });

  const resp = await chatClient.chatCompletion({
    inputParams: { question: prompt }
  });

  return resp.getContent();
};
