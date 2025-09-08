namespace aimodel;

using {cuid} from '@sap/cds/common';

entity Prompts : cuid {
  prompt    : String;
  response  : String;
  createdAt : Timestamp;
}


