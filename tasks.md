# Langdock Masumi Integration Plan

Goal: user gives Langdock API key, Langdock agent ID, agent metadata, pricing. Masumi SaaS validates Langdock, registers generated MIP-003 endpoint, handles payment flow, exposes agent on Sokosumi.

## Current Progress

Status: automated integration pass complete; live Sokosumi/Langdock smoke still needs real credentials and a running app environment.

Done:

- Branch created: `feature/langdock-masumi-integration`.
- Plan written.
- DB schema/migration added for runtime providers, integration connections, MIP jobs.
- Prisma client regenerated after `pnpm install`.
- Langdock client/service helpers added.
- MIP hash + input-schema helpers added.
- Public runtime namespace added at `/mip/agents/[agentId]/*`.
- Payment-node client extended for runtime payment create/resolve/submit-result.
- `/api/agents` extended for Direct MIP vs Langdock provider flow.
- Integrations page + nav item added.
- Register agent dialog extended with provider selector, Langdock key/agent fields, test/autofill.
- Route scoping fixed: `status` and `provide_input` bind `job_id` to route `agentId`.
- Saved Langdock connections reuse stored `baseUrl` metadata during registration/test when the form value is blank.
- Focused unit coverage added for Langdock field conversion/client probing, MIP hash helpers, runtime job transitions, status route scoping, and `/api/agents` provider branching.

Pending:

- Manual Sokosumi smoke against Preprod + Mainnet with real Langdock credentials.
- PR final notes after smoke.

Verification so far:

- `pnpm install` succeeded; warned current Node is `v25.2.1`, repo wants `24.x`.
- `packages/database prepare` ran Prisma generate + DB package build successfully during install.
- `pnpm --filter web lint` passed.
- `pnpm --filter web run i18n:validate` passed after adding fallback locale keys.
- `pnpm --filter web test src` passed: 68 files, 236 tests.
- Focused Langdock/MIP tests passed: `src/lib/integrations/langdock.test.ts`, `src/lib/mip/hash.test.ts`, `src/lib/mip/langdock-runtime.test.ts`, `src/app/api/agents/route.test.ts`.
- `pnpm --filter web exec tsc --noEmit --pretty false` passed.
- `pnpm --filter web run check-openapi-json` passed.
- `pnpm --filter web test` failed only on smoke/e2e/stress tests that require a live app at `localhost:2999`; failures were `ECONNREFUSED`.
- `DATABASE_URL=postgres://spec-gen:spec-gen@localhost:5432/spec-gen pnpm --filter web build` hung locally in `next build`/Turbopack compile with the process idle at 0% CPU and was stopped after repeated attempts.
- `pnpm prisma:generate` before install failed because `node_modules` was missing.

## Locked Decisions

- Runtime provider options: `DIRECT_MIP`, `LANGDOCK`.
- Direct MIP path stays current path: user gives ready MIP-003 base URL.
- Langdock path: SaaS generates public MIP base URL: `/mip/agents/{agentId}`.
- Langdock agents always HITL.
- Store Langdock API key as reusable scoped integration connection.
- Store Langdock agent ID in agent provider config.
- Scope connection to active org when present, else user.
- Support `Preprod` and `Mainnet`.
- Test Langdock connection before registration.
- Use owner/user scoped payment-node key for runtime payment init, resolve, submit-result.
- Keep `/mip/*` public runtime separate from `/api/v1`, `/pay/api/v1`, `/registry/api/v1`.

## Phase 1: Data Model

### Task 1.1: Add runtime provider enum

- Add Prisma enum `AgentRuntimeProvider`.
- Values:
  - `DIRECT_MIP`
  - `LANGDOCK`
- Add `Agent.runtimeProvider AgentRuntimeProvider @default(DIRECT_MIP)`.

Acceptance:

- Existing agents default `DIRECT_MIP`.
- Prisma generate succeeds.

Test:

- `pnpm prisma:generate`
- DB migration contains default/backfill.

### Task 1.2: Add integration connection model

- Add Prisma model `IntegrationConnection`.
- Fields:
  - `id`
  - `provider`
  - `name`
  - `encryptedSecret`
  - `userId`
  - `organizationId`
  - `metadata Json?`
  - timestamps
- Add enum `IntegrationProvider`.
- Values:
  - `LANGDOCK`
- Add indexes:
  - `[userId, provider]`
  - `[organizationId, provider]`
- Add relation from `Agent.integrationConnectionId`.

Acceptance:

- Connection can belong to user or org.
- Agent can reference connection.
- Delete user/org cascades or nulls safely per existing ownership pattern.

Test:

- Prisma validate/generate.

### Task 1.3: Add provider config

- Add `Agent.providerConfig Json?`.
- Store:
  - `langdockAgentId`
  - `langdockBaseUrl`
  - `inputSchema`
  - `hitl: true`

Acceptance:

- Direct agents keep `providerConfig = null`.
- Langdock agents have enough config to execute without frontend input.

Test:

- Registration unit test asserts config saved.

## Phase 2: Secret + Langdock Service

### Task 2.1: Add reusable secret helper

- Reuse existing AES-GCM payment-node encryption or extract generic helper.
- No plaintext API key in logs, client JSON, or DB.

Acceptance:

- Stored value encrypted.
- Decrypt only server-side.

Test:

- Unit test encrypt/decrypt roundtrip.
- Unit test no raw key appears in API response.

### Task 2.2: Add Langdock client

- New server-only lib:
  - `getAgent(apiKey, agentId, baseUrl)`
  - `testAgent(apiKey, agentId, baseUrl)`
  - `completeChat(apiKey, agentId, messages, baseUrl)`
- Default base URL: `https://api.langdock.com`.
- Use timeouts.
- Return typed errors.

Acceptance:

- Invalid key/agent rejected before registration.
- Valid agent returns metadata for autofill.

Test:

- Mock fetch success for `GET /agent/v1/get`.
- Mock fetch failure -> 400/422.
- Mock chat test call -> ok.

### Task 2.3: Convert Langdock fields to MIP input schema

- Convert Langdock `inputFields` to MIP schema.
- Fallback schema:
  - field `text`, type `textarea`, name `Prompt`.
- HITL continuation schema:
  - `message` textarea
  - `finish` boolean

Acceptance:

- Generated schema passes MIP input schema validation.
- Schema hash stable.

Test:

- Conversion unit tests for string/text/number/boolean/options.
- Unknown field type -> textarea fallback.

## Phase 3: Registration API

### Task 3.1: Extend `/api/agents` body

- Add `runtimeProvider`.
- Direct:
  - require `apiUrl`.
- Langdock:
  - require `langdockApiKey` or existing `integrationConnectionId`.
  - require `langdockAgentId`.
  - ignore user `apiUrl`; generate app URL.

Acceptance:

- Existing direct request still works.
- Langdock request validates key + agent before credit consume/registration.
- Response shape stays compatible.

Test:

- Existing route tests still pass.
- New route test: direct missing apiUrl fails.
- New route test: Langdock invalid credentials fail.
- New route test: Langdock valid creates connection + agent.

### Task 3.2: Generate public app URL

- Add canonical app URL helper using existing app/auth env.
- Build `apiUrl = {APP_URL}/mip/agents/{agentId}`.
- Use app-generated CUID before create, so URL known at insert.

Acceptance:

- Registered on-chain metadata contains `/mip/agents/{agentId}`.
- No request-origin trust.

Test:

- Unit test URL generation.

### Task 3.3: Store connection

- If new Langdock API key supplied:
  - create/update scoped `IntegrationConnection`.
- If existing connection chosen:
  - verify access by user/org scope.
  - decrypt and validate.

Acceptance:

- Org connection invisible to other org.
- User connection used when no org active.

Test:

- Scope unit tests.

## Phase 4: Public MIP Runtime

### Task 4.1: Add route namespace

- Add Next routes:
  - `GET /mip/agents/[agentId]/availability`
  - `GET /mip/agents/[agentId]/input_schema`
  - `POST /mip/agents/[agentId]/start_job`
  - `GET /mip/agents/[agentId]/status`
  - `POST /mip/agents/[agentId]/provide_input`

Acceptance:

- Registry service health check sees `type: "masumi-agent"` and agent identifier when available.
- Sokosumi can start paid job.

Test:

- Route tests for each endpoint.
- Invalid provider -> 404/422.

### Task 4.2: Add job persistence

- Add Prisma model `MipJob`.
- Fields:
  - `id`
  - `agentId`
  - `identifierFromPurchaser`
  - `inputData Json`
  - `inputHash`
  - `outputHash`
  - `result`
  - `status`
  - `blockchainIdentifier`
  - payment timestamps
  - `conversation Json?`
  - `error`
  - timestamps
- Add enum `MipJobStatus`.

Acceptance:

- Jobs survive process restart.
- Status endpoint reads DB only.

Test:

- Start job creates row.
- Status returns row state.

### Task 4.3: Start job payment init

- On `start_job`:
  - validate agent active enough.
  - compute input hash same as wrapper/Sokosumi contract.
  - call payment-node `POST /payment` with owner scoped token.
  - save payment fields.
  - return paid MIP response.

Acceptance:

- Response matches Sokosumi `startPaidJobResponseSchema`.
- Uses agent selling wallet scope, not admin key.

Test:

- Mock payment-node init.
- Assert body includes `agentIdentifier`, `identifierFromPurchaser`, `inputHash`, `network`.

### Task 4.4: Worker execution

- Add async runner fn:
  - poll payment resolve until funds locked or timeout.
  - call Langdock initial message.
  - set status `awaiting_input`.
- MVP trigger:
  - start in background after `start_job`.
  - status/provide_input can also resume stale jobs.

Acceptance:

- No in-memory-only state.
- Background crash can resume by status/provide_input call.

Test:

- Unit test state transitions.
- Mock payment locked -> Langdock called.

### Task 4.5: HITL continuation

- `provide_input`:
  - validate `input_schema_hash`.
  - append user message.
  - if finish text/boolean/action -> finalize transcript.
  - else call Langdock, append assistant reply, stay awaiting input.
- Finish commands:
  - `DONE`
  - `finish`
  - `submit`
  - boolean `finish`
  - boolean `done`
  - boolean `submit`
  - action finish/submit/done.

Acceptance:

- Always HITL for Langdock.
- Completed job submits result hash to payment node.

Test:

- Continuation test.
- Finish test.
- Bad schema hash fails.
- Submit-result called only on completion.

### Task 4.6: Hash compatibility

- Implement:
  - canonical JSON input hash: `sha256(identifierFromPurchaser + ";" + canonicalJson(input_data))`
  - result hash: `sha256(identifierFromPurchaser + ";" + escaped result)`
  - input schema hash: normalized schema canonical JSON.

Acceptance:

- Hashes match Sokosumi package behavior.

Test:

- Golden tests copied from known values.

## Phase 5: UI

### Task 5.1: Add Integrations nav/page

- Add `/integrations`.
- Show Langdock connection state.
- Add form:
  - API key
  - optional base URL
  - test connection
- Keep UI dense, app-like, no landing page.

Acceptance:

- User can add/test Langdock key before agent registration.

Test:

- Component/route smoke where feasible.
- Manual browser test.

### Task 5.2: Extend register agent dialog

- Add runtime selector:
  - MIP-003 endpoint
  - Langdock
- Direct mode shows API URL.
- Langdock mode shows:
  - API key or saved connection
  - Langdock agent ID
  - test/autofill button
- Autofill:
  - name
  - description
  - icon if usable
  - input schema hidden in provider config

Acceptance:

- Direct UX unchanged by default.
- Langdock user gives key + agent ID + pricing/metadata.

Test:

- Form validation tests if existing setup supports.
- Manual UI test at desktop/mobile.

### Task 5.3: Add i18n copy

- Update `messages/en.json`.
- Add fallback keys for new labels/errors.

Acceptance:

- No missing translation key in registration dialog or integrations page.

Test:

- `pnpm --filter web i18n:validate`

## Phase 6: Payment Node Client

### Task 6.1: Add payment APIs

- Add schemas + methods:
  - `createPayment`
  - `resolvePaymentByBlockchainIdentifier`
  - `submitPaymentResult`
- Use existing response parser.

Acceptance:

- Runtime code does not call SaaS proxy routes internally.
- Scoped token auth headers used.

Test:

- Client unit tests with mock fetch.

## Phase 7: Verification

### Task 7.1: Unit tests

- Langdock client.
- Input schema conversion.
- Hash helpers.
- MIP runtime service state transitions.
- Registration route provider branching.

Done:

- Tests pass.

### Task 7.2: Type/lint/build

- Run:
  - `pnpm prisma:generate`
  - `pnpm --filter web test`
  - `pnpm --filter web lint`
  - `pnpm --filter web build`

Done:

- Commands pass, or blocker logged with exact failure.

### Task 7.3: Manual smoke

- Direct MIP registration still works.
- Langdock registration:
  - invalid key blocked
  - valid key autofills metadata
  - agent registers with `/mip/agents/{agentId}`
  - `/availability` online
  - Sokosumi start job gets payment response
  - payment lock -> Langdock initial answer -> `awaiting_input`
  - `provide_input` continues
  - finish submits result

Done:

- Smoke notes added to PR.

## Phase 8: PR

### Task 8.1: Docs

- Update env docs if new vars added.
- Add short usage notes for Langdock setup.

Acceptance:

- Dev can run feature locally.

### Task 8.2: PR summary

- Include:
  - schema changes
  - runtime endpoints
  - UI changes
  - payment auth model
  - test output
  - known limitations

Acceptance:

- PR review can verify scope without rereading whole diff.
