# Fable — Party Membership, Connection and Reconnect Lifecycle

**Date:** 2026-10-28  
**Status:** UNCONFIRMED PROPOSAL — multiplayer session policy. It does not select an authentication vendor or change current source code.  
**Related:** docs 00 (product principles), 02 (party rules), 28 (adapter), 33 (campaign lifecycle), 36 (protocol), 39 (recovery), 41 (readiness gates).

## 1. Why identity, membership and connection are different

Do not represent “player”, “connection”, “hero” and “party member” as one ID or one boolean.

- **Account/principal:** trusted identity established by the authentication layer; provider is intentionally not selected here.
- **Campaign membership:** authorization to participate in this campaign, including campaign role and any explicitly granted permissions.
- **Actor:** the authorized principal/session context submitting a command.
- **Hero:** the in-game character whose state is controlled by an authorized party member.
- **Connection/session:** a temporary transport connection that may disappear and reconnect.
- **Device/client instance:** a presentation endpoint such as phone, TV or GM tablet; it is not the owner of campaign state.

Current confirmed party rules define 2–4 players and one GM, with one actor bound to one hero. The transport must derive this mapping from trusted server state, not client join options. A reconnecting socket must not create another membership or another hero.

## 2. Proposed connection states

Use transport/session presence as an orthogonal operational fact:
- CONNECTED — a currently authenticated connection is available;
- DISCONNECTED — the transport is absent, but campaign membership and hero ownership remain;
- REAUTHENTICATING — a reconnect is in progress; no gameplay authority is granted until identity/membership are verified.

Do not encode connection presence into gameplay alive state, injury status, party membership or campaign activity. The network may be disconnected while the party remains in an active scene.

A transport ping/heartbeat can help detect a lost connection, but its timeout is not a gameplay choice and cannot itself confirm a route, choose a dialogue option, approve a scene or trigger an outcome.

## 3. Temporary disconnect defaults

### Player disconnects in city/world-map/dialogue
- Keep the authenticated campaign membership and hero binding.
- Preserve the shared dialogue and current campaign activity.
- Do not automatically choose an offered response, end dialogue, cancel travel or remove the party member.
- A world-map selection is provisional; reconnect can restore WORLD_MAP mode even if the local route highlight resets.
- Shared dialogue continues from the server-owned current node; it does not advance because one device disappeared.

### Player disconnects during battle
- Keep the hero in the existing authoritative scene. Do not duplicate or respawn it.
- Do not infer movement, defense, card use, retreat or any other action from silence.
- The existing server simulation continues according to its confirmed tick/intent rules; do not invent an AI pilot or free action for an offline hero.
- The GM retains the existing authority to resolve available consequences/outcomes; the system does not auto-confirm a result because the GM or player is offline.
- Reconnect returns the latest authorized projection and request status, not a client-side snapshot from before disconnect.

This default may be harsh in play, but it is safer and deterministic than secretly giving a disconnected player actions. If a future pause/AI takeover/grace period is desired, define it as a new gameplay rule, not a transport timeout.

## 4. GM disconnect defaults

- No pending scene proposal, consequence or scene outcome is implicitly approved/rejected.
- Pending approvals remain pending and visible to the authorized GM after reconnect.
- Existing active-scene simulation follows the current server tick rules; this proposal does not introduce pause/resume semantics.
- No other player becomes GM automatically, and no player-supplied role claim can take over the GM role.
- If product design later requires GM handoff, implement an explicit, audited transfer flow that revalidates authority, resolves pending proposals and protects GM-only state.

Because the current runtime contract records a non-paused scene, do not pretend that “the GM disconnected” pauses combat unless an approved server-side pause rule and implementation are added.

## 5. Explicit leave is not a disconnect

First-slice default:
- The client cannot remove itself from the campaign simply by closing the app, losing network, or clearing local data.
- A deliberate party-membership change is a campaign command validated by the server and recorded as a campaign event.
- During an active blocking scene or pending transition, party roster changes are not applied directly. They wait for a defined safe boundary or an authorized GM workflow.
- If a roster change would leave fewer than the confirmed minimum of 2 players, prevent starting a new scene until the roster satisfies the rule or the GM explicitly ends/administratively resolves the session according to a separately defined policy.
- Never delete the departed hero's campaign record just because their membership changes. Hero transfer, retirement, permanent death and campaign archival are distinct mechanics that require their own rules.

The first slice need not implement self-service leave, replacement players, hero transfer or permanent retirement. It only needs to reject unsupported attempts safely.

## 6. Multiple connections and command authority

- One authenticated campaign member may have several presentation connections only if the product explicitly permits it; there is still one membership and one controlled hero.
- The same principal cannot bypass a blocking dialogue or send logically conflicting actions through a second socket.
- Idempotency should be scoped to a stable server-authenticated actor/principal plus campaign and request ID, rather than only a transient socket identifier. Keep session IDs as audit metadata and reject cross-principal ID spoofing.
- Each mutating command is authorized against current campaign membership, current activity, hero binding and relevant revision at commit time.
- A disconnected/stale client cannot extend the validity of old commands. On reconnect, it must fetch current revision and refresh pending intentions.
- Clients must ignore late responses/snapshots older than the most recently applied authoritative revision.

## 7. Reconnect protocol

1. Authenticate the principal again using the chosen auth/session mechanism.
2. Restore only memberships already owned/authorized by the server; never trust a client-supplied role as proof.
3. Resolve the caller's current actor-to-hero binding.
4. Load current campaign activity/revision and active scene revision, if any.
5. Return the appropriate role-filtered projection.
6. Return status for the caller's outstanding request IDs and currently authorized shared dialogue/approval state.
7. Let the client reconcile pending animations with server truth; only the terminal server result means a mutation succeeded.
8. Rate-limit repeated reconnect/resync requests and avoid broadcasting a full private runtime snapshot.

A reconnect never rewinds campaign state to the client's last saved display. The server's current authoritative aggregate and journal define truth.

## 8. Proposed lifecycle events (future contract only)

Candidate campaign/session event categories:
- campaign_member_joined
- campaign_member_leave_requested
- campaign_member_left
- campaign_member_change_rejected
- player_connection_lost (operational/audit event; not necessarily a gameplay event)
- player_connection_restored (operational/audit event; not necessarily a gameplay event)
- gm_handoff_requested / gm_handoff_completed (deferred feature)
- campaign_session_closed

Do not add these to existing canonical scene event schemas without an explicit versioned contract. Connection telemetry may be stored outside the gameplay journal if it has no gameplay effect; if it changes gameplay policy, it must be recorded authoritatively and replayed.

## 9. Acceptance tests

1. Same player reconnects on a new socket and retains one membership and one hero.
2. Client claims GM role in join options; server authorization denies it.
3. Player disconnects during dialogue; current node remains unchanged and no choice effects run.
4. Player disconnects during battle; no implicit actions occur and no duplicate hero spawns.
5. Reconnecting player receives current scene/campaign revisions, not stale client state.
6. Old request IDs after reconnect return stored lifecycle status or a safe stale/conflict result.
7. Two sockets submit conflicting choices for the same shared dialogue; only one authoritative commit occurs.
8. GM disconnects while approval is pending; no auto-approval/rejection occurs.
9. A different player cannot take over GM role by declaring a new role in a payload.
10. Explicit roster change during an active scene is rejected or deferred under the selected policy.
11. A leave attempt that violates the minimum party size cannot start an invalid next scene.
12. Connection telemetry never exposes hidden route/dialogue/hero fields.
13. Late stale projection cannot overwrite a newer campaign/scene revision.
14. Existing engine tick/outcome behavior remains unchanged when no new explicit pause rule exists.

## 10. Scope boundary and implementation order

This is a design proposal, not an auth implementation. Before transport coding:
- select the actual authentication/session mechanism;
- define server-trusted principal and membership records;
- implement authorization and actor-to-hero binding before exposing game-changing commands;
- test reconnect/idempotency and serialized projections;
- leave GM handoff, AI takeover, automatic pause and player voting deferred until separately designed.
