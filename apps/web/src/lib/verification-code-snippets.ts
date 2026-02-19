export type VerificationSnippetLang =
  | "node"
  | "python-flask"
  | "python-fastapi"
  | "go";

export const VERIFICATION_SNIPPET_LANGUAGES: {
  value: VerificationSnippetLang;
  monacoLang: string;
}[] = [
  { value: "node", monacoLang: "javascript" },
  { value: "python-flask", monacoLang: "python" },
  { value: "python-fastapi", monacoLang: "python" },
  { value: "go", monacoLang: "go" },
];

export function getVerificationCodeSnippet(
  secret: string,
  lang: VerificationSnippetLang,
): string {
  switch (lang) {
    case "node":
      return `// Add to your .env (keep this secret!)
MASUMI_VERIFICATION_SECRET=${secret}

// Express route - add to your agent
app.get('/get-credential', (req, res) => {
  const challenge = req.query.masumi_challenge;
  if (!challenge) return res.status(400).send('Missing masumi_challenge');
  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', process.env.MASUMI_VERIFICATION_SECRET)
    .update(challenge)
    .digest('hex');
  res.type('text/plain').send(signature);
});`;
    case "python-flask":
      return `# Add to your .env (keep this secret!)
MASUMI_VERIFICATION_SECRET=${secret}

# Flask route - add to your agent
import hmac
import hashlib
import os
from flask import request

@app.route('/get-credential')
def get_credential():
    challenge = request.args.get('masumi_challenge')
    if not challenge:
        return 'Missing masumi_challenge', 400
    secret = os.environ.get('MASUMI_VERIFICATION_SECRET', '').encode()
    signature = hmac.new(secret, challenge.encode(), hashlib.sha256).hexdigest()
    return signature`;
    case "python-fastapi":
      return `# Add to your .env (keep this secret!)
MASUMI_VERIFICATION_SECRET=${secret}

# FastAPI route - add to your agent
import hmac
import hashlib
import os
from fastapi import Query, HTTPException
from fastapi.responses import PlainTextResponse

@app.get("/get-credential")
def get_credential(masumi_challenge: str | None = Query(None)):
    if not masumi_challenge:
        raise HTTPException(400, "Missing masumi_challenge")
    secret = os.environ.get("MASUMI_VERIFICATION_SECRET", "").encode()
    signature = hmac.new(secret, masumi_challenge.encode(), hashlib.sha256).hexdigest()
    return PlainTextResponse(signature)`;
    case "go":
      return `// Add to your .env (keep this secret!)
// MASUMI_VERIFICATION_SECRET=${secret}

// Go handler - add to your agent
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "net/http"
    "os"
)

func getCredential(w http.ResponseWriter, r *http.Request) {
    challenge := r.URL.Query().Get("masumi_challenge")
    if challenge == "" {
        http.Error(w, "Missing masumi_challenge", http.StatusBadRequest)
        return
    }
    secret := []byte(os.Getenv("MASUMI_VERIFICATION_SECRET"))
    h := hmac.New(sha256.New, secret)
    h.Write([]byte(challenge))
    signature := hex.EncodeToString(h.Sum(nil))
    w.Header().Set("Content-Type", "text/plain")
    w.Write([]byte(signature))
}`;
    default:
      return getVerificationCodeSnippet(secret, "node");
  }
}
