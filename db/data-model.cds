namespace aimodel;

using {cuid} from '@sap/cds/common';

entity Prompts : cuid {
  prompt    : String;
  response  : String;
  isReport  : Boolean;
  createdAt : Timestamp;
}
