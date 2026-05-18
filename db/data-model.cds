namespace aimodel;

using {cuid} from '@sap/cds/common';

entity Prompts : cuid {
  prompt    : String;
  response  : String;
  isReport  : Boolean;
  createdAt : Timestamp;
  document : Association to Documents;
}

entity Documents : cuid {
  fileName      : String;
  mimeType      : String;
  size          : Integer;
  extractedText : LargeString;
  createdAt     : Timestamp;
  createdBy     : String;
}

entity DocumentAnalysis : cuid {
  document  : Association to Documents;
  analysis  : LargeString; // JSON string returned by AI
  createdAt : Timestamp;
  model     : String;
}
