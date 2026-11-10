# Validation record

Initial publication, 9 November 2026. macOS, Node v26.5.0. Fresh in-memory and disposable on-disk SQLite databases; no Ringfence state or credentials used.

- `npm install --package-lock-only`: passed; no dependencies.
- `npm test`: 15 tests passed, zero failures. Includes all eight tool outcomes, ownership, verification, exact single-use consent, reconciliation, strict arguments, session isolation, persistence, request caps, concurrency, expiry, HTTP capabilities, and provider doubles.
- `node src/compare.mjs`: six deterministic trials. Both misuse cases allowed by baseline and denied by Gate; legitimate write completed in both arms. Checked parsed results and independently read stored rows. These are model-free fixture outcomes, not security-rate estimates.
- Standalone `src/server.mjs` subprocess with temporary DATA_DIR and provider disabled: started on an ephemeral loopback port; `src/client.mjs create` and `evidence` completed and returned ten isolated records. Subprocess and temporary database removed afterward.
- Public-file scan: no credentials, environment values, original private artifacts or production service configuration included.

Not run locally: actual OpenAI model, transcription or speech calls; microphone capture; telephony; acoustic attack reproduction; real customer authentication. Provider tests use explicit test doubles. Node 24 is the CI target; see GitHub Actions for its result. No running service is publicly deployed.
