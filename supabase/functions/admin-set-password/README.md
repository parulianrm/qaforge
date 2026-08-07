# admin-set-password

Edge Function used by Manage Access's "Ubah Password" (KeyRound icon) button
to let an admin set a new password directly for an email/password account.
Requires the `service_role` key, so it must run server-side — this cannot be
done from the browser.

## Deploy

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to
this project (`supabase link --project-ref <your-project-ref>`):

```bash
supabase functions deploy admin-set-password
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
provided automatically by the Supabase platform to every Edge Function — no
manual secret configuration needed.

## What it checks

The function verifies the caller's own JWT (forwarded automatically by
`supabase.functions.invoke` from the client) has the `manage_access`
permission on their role before touching anything. Only after that check
passes does it use the service_role client to call
`auth.admin.updateUserById`.
