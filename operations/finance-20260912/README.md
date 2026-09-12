# Activation of Finance from merged PR #310

This operational branch activates the already deployed production release
`60505806007c717e3dab5078396fd7ad48777c52`, following the owner's request to
continue activation. It does not merge a PR or deploy application code from this
branch. The branch-specific GitHub Actions workflow uses the existing VPS SSH
deployment secret and shares the `deploy-vps` concurrency group.

The script checks the installed release and runtime database, saves a root-only
database backup under `/var/backups/eznihongo/finance-activation-<random>/`,
restores it into an isolated database with original ownership and grants, and
tests the existing Finance migration, idempotency, report query and staff erasure
compatibility using the application's database credentials. Only after those
checks does it run the additive migration on production.

Finance is enabled through `/etc/eznihongo/finance.env` and the systemd drop-in
`/etc/systemd/system/eznihongo-api.service.d/99-eznihongo-finance.conf`. The app's
existing `.env` remains intact. A failed restart/verification restores the exact
previous feature configuration and restarts the API; Finance tables remain so
no database restore or student-data rollback is needed. Successful activation
checks API health, Finance's unauthenticated HTTP 401, the running process's flag
and database target, and the Finance frontend release marker. It does not create
an owner token or make up bookkeeping dates, opening balances or transactions.

Credentials and database contents never leave the VPS or appear in workflow
logs. Only the random temporary restore database is dropped. Backups are retained
locally for the operator; this operation does not run the existing retention or
offsite upload script.

Validation: `node --test operations/finance-20260912/activate.test.mjs`.
The application itself already passed the PR #310 and main deployment CI.
Keep this workflow on its dedicated operational branch; it is not a recurring
part of normal deployment. Reruns are restricted to the pinned installed release
and the migration checksum remains idempotent.
