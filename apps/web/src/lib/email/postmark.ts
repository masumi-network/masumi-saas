import * as Postmark from "postmark";

import { emailConfig } from "@/lib/config/email.config";

let postmarkClient: Postmark.ServerClient | null = null;

if (emailConfig.postmarkServerId) {
  postmarkClient = new Postmark.ServerClient(emailConfig.postmarkServerId);
}

export { postmarkClient };
