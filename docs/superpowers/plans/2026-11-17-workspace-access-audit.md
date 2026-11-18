# Workspace access audit

Request: audit all accounts after a report of uninvited workspaces. Production read-only inventory found 13 accounts, 15 workspaces and 23 membership rows, all consistent with active users. Shared demo/LTI namespaces have distinct synthetic identities; five practice copies each have one account member. Membership consistency alone cannot prove how an invitation was originally obtained: historical invite acceptance is not logged.

Investigate: fresh unrelated accounts cannot list/switch/read/write another workspace; tampered session namespaces must fail; attachment IDs and team IDs cannot cross workspace boundaries; removed membership must invalidate existing workspace sessions. Inspect logout/in-flight responses as a separate client isolation boundary.

Design if reproduced: validate current membership plus active workspace user for every account-scoped workspace session, retaining account-level operations and valid monitor reinvites. Make sign-out wait for server cookie deletion and reload the app to discard stale account responses. Do not alter production memberships or delete user workspaces. Do not conflate repeated practice names with access to the same namespace.

Validation: isolated database HTTP tests for unrelated accounts, chat/file isolation, signed/tampered and revoked sessions; browser delayed-response logout/account-switch regression; existing portal/professor/account tests; lint/typecheck/build; review and deploy only confirmed fixes. Report remaining uncertainty honestly.

Critique: do not trust workspace JSON alone after membership removal; do not indiscriminately revoke sessions or disable real workflows. Account-level invitation acceptance must remain available after workspace revocation. Preserve demo/LTI behavior and never access real users' chat/file content during the production audit.
