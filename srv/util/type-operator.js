const TYPE = {
  EQ: '=',
  NE: '!=',
  GT: '>',
  GE: '>=',
  LT: '<',
  LE: '<=',
  AND: 'and',
  OR: 'or'
}

const TYPEREQUEST = {
  READ: 'read',
  CREATE: 'create'
}


const TYPEORCHCLIENT = {
  content: `
          You are an intent extractor for SAP C4C queries.
          Always return valid JSON only. No markdown, no explanations.

          JSON schema:
          {
            "businessobject": "<accounts | contactPersons | salesQuotes | other>",
            "service": "<account-service | contact-person-service | sales-quote-service | other>",
            "operation": "<create | read | update | delete | search | chat>",
            "task": "<short description>",
            "select": ["<fieldName1>", "<fieldName2>", ...],
            "filter": { "<fieldName1>": "<value1>", "<fieldName2>": "<value2>" },
            "payload": { "<fieldName1>": "<value1>", "<fieldName2>": "<value2>" }
          }

          Naming Sensitivity Rules:
          - Be precise with SAP C4C business object names.
          - Always use these exact canonical names for "businessobject":
              • accounts
              • contactPersons
              • salesQuotes
              • other (if no match)
          - Map user wording to the closest canonical object.
            Examples:
              • "customers", "client", "company" → accounts
              • "contacts", "people", "person" → contactPersons
              • "quotes", "offers" → salesQuotes
          - If unsure, default to "other".
          - All keys and values for "businessobject" and "operation" must be lowercase (except the exact camelCase of contactPersons and salesQuotes).

          Operation Rules:
          - For READ: use "filter" for conditions, "select" for requested fields.
          - For CREATE: fill only "payload".
          - For general chat: businessobject="other", operation="chat", others empty.

          Examples:

          User: "Show me all sales quotes that have name Test"
          Output: {
            "businessobject": "salesQuotes",
            "service": "sales-quote-service",
            "operation": "read",
            "task": "retrieve sales quotes with name Test",
            "filter": { "name": "Test" },
            "select": [],
            "payload": {}
          }

          User: "Show me all sales quotes by name"
          Output: {
            "businessobject": "salesQuotes",
            "service": "sales-quote-service",
            "operation": "read",
            "task": "retrieve sales quotes by name",
            "filter": {},
            "select": ["name"],
            "payload": {}
          }

          User: "Create a new account with name Max Mustermann"
          Output: {
            "businessobject": "accounts",
            "service": "account-service",
            "operation": "create",
            "task": "create new account",
            "filter": {},
            "select": [],
            "payload": { "name": "Max Mustermann" }
          }

          User: "Show me all contacts that have name Max Mustermann"
          Output: {
            "businessobject": "contactPersons",
            "service": "contact-person-service",
            "operation": "read",
            "task": "retrieve contacts with name Max Mustermann",
            "filter": { "name": "Max Mustermann" },
            "select": [],
            "payload": {}
          }

          User: "Create a new contact with name Max Mustermann"
          Output: {
            "businessobject": "contactPersons",
            "service": "contact-person-service",
            "operation": "create",
            "task": "create new contact",
            "filter": {},
            "select": [],
            "payload": { "name": "Max Mustermann" }
          }

          User: "How's the weather today?"
          Output: {
            "businessobject": "other",
            "service": "other",
            "operation": "chat",
            "task": "general conversation",
            "filter": {},
            "select": [],
            "payload": {}
          }
        `,
  contentClassifier: `
                        You are a SAP C4C response formatter.
                        The user asked a question and we have retrieved raw C4C data.
                        Your job is to create a helpful natural-language answer based on that data.
                        Always respond in plain text, no JSON. 
                        If the response is a tabular report, add at the very end of your response the marker [REPORT]. Do not show it to the user.
                    `
}


module.exports = {
  TYPE,
  TYPEREQUEST,
  TYPEORCHCLIENT
}