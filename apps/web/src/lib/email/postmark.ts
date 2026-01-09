import * as Postmark from "postmark";

let postmarkClient: Postmark.ServerClient | null = null;

if (process.env.POSTMARK_SERVER_ID) {
  postmarkClient = new Postmark.ServerClient(process.env.POSTMARK_SERVER_ID);
}

export { postmarkClient };
