# Regras da ponte de funções de servidor

- Passkey (digital) login is issued server-side: `passkey-login` verifies the WebAuthn assertion and `_shared/sessao-sgm.ts` opens the Supabase session, so password and digital entry share one session path; the challenge travels in a signed one-time token instead of a table, and `usuario_passkeys` rows are readable only by their own user.
