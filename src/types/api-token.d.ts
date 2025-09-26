// new-front-end/src/types/api-token.d.ts
export interface APIToken {
  ID: string;
  Name: string;
  Status: string;
  Created: string;
  Last_Used: string;
  Due_Time: string;
  Scope: string[];
  Owner: string;
}