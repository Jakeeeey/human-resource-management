// Redacted mail logging home (mailing-module Appendix — DispatchCtx row).
//
// `logRedacted` is owned by `../providers/mailTransport` (it shares the
// module's redact() policy); this file ONLY re-exports it so hook-site
// insertions (todo 11) and dispatch import from one stable path. No
// redact logic is duplicated here by design.

export { logRedacted, redact, scrubSecretsFromText } from "../providers/mailTransport";
