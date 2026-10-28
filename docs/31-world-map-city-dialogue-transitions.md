# Fable — World Map, City, NPC Dialogue & Activity Transitions

**Date:** 2026-10-28  
**Status:** PROPOSAL — conceptual architecture; not a confirmed gameplay contract or implementation task.  
**Supersession note:** for owner decisions made after this initial concept, follow [docs/32](./32-owner-decisions-world-interaction-loop.md) and [docs/37](./37-world-interaction-default-policy-register.md). The later battle-end cleanup rule resets battle-only stamina, deck runtime and explicitly battle-scoped temporary statuses immediately when a battle ends; this is separate from city HP recovery.  
**Scope:** fill the missing connective layer between the existing headless expedition/combat engine and the future player-facing game loop.  
**Repository boundary:** this document belongs to `fable-context`. It does not authorize changes to `fable-rpg` or silently amend confirmed rules.

## 1. Why this layer matters

The current headless slice proves a narrow loop: `city → route → node → scene → outcome → city checkpoint`. It does not yet define a complete interactive world experience. A world map, city stay, NPC conversation, shop/service interaction, scene entry, and return from an expedition are not merely separate screens: they are modes of one campaign state machine with permissions, persistence, visibility, and explicit transitions.

The design goal is to make those activities feel continuous to players while keeping the server authoritative and the rules engine headless. UI navigation alone must never create a campaign transition.

## 2. Product model: four spatial scales

Keep these concepts separate; do not overload one “map” model.

1. **World map** — regions and route connections between named locations. It answers “where can we go?” It is not a tactical grid and does not represent exact character coordinates.
2. **Location map** — a city district, building, inn, guild hall, market, shrine, or expedition site. It answers “where in this place are we?” It may be a lightweight illustrated map with clickable locations, not necessarily a grid.
3. **Tactical scene grid** — the existing cell-based scene used where exact positions matter: combat, hazards, positioning, or a specifically authored grid encounter.
4. **Interface map/view** — the client’s current presentation. Switching tabs or opening a journal is not a game-state transition.

A location may have several interaction points and authored scenes. A node can contain a city, wilderness location, dungeon, or several sequential scenes. Do not assume one node equals one combat map.

## 3. Campaign state machine

Represent the campaign’s current activity explicitly on the server. Proposed top-level modes:

- `CITY` — party is at a safe settlement checkpoint; city services and NPCs are available according to content and campaign state.
- `WORLD_MAP` — party is planning or confirming travel between known/available nodes.
- `LOCATION` — party is exploring a non-tactical location and interacting with authored points of interest.
- `DIALOGUE` — one interaction session with an NPC or other speaker is active; the parent context (city/location/scene) is retained.
- `EXPEDITION_PREPARATION` — party composition, route, supplies, and departure checks; only include if the product needs a distinct preparation phase.
- `SCENE` — an authored encounter or event is active. It may be combat, exploration, negotiation, puzzle, or a GM-led event.
- `OUTCOME` — a scene/expedition has a pending result, GM confirmation, or reward/aftermath step.
- `RECOVERY` — post-expedition recovery and settlement processing, if this is distinct from the existing city checkpoint.

Do not implement all of these as unrelated booleans. Use a discriminated state with a small, explicit set of legal transitions. The exact enum and whether preparation/recovery deserve separate modes remain implementation decisions.

### Proposed high-level flow

```text
CITY <-> WORLD_MAP
  |           |
  |           +---- travel confirmation ----> LOCATION / SCENE
  |                                            |
  +-- enter city POI --> DIALOGUE / SERVICE    +--> DIALOGUE
  |                                            |
  +-- depart --> EXPEDITION_PREPARATION --------+
                      |
                      v
                  EXPEDITION
                      |
               scene / node chain
                      |
                      v
                   OUTCOME
                      |
              rewards + world facts
                      |
                      v
             CITY checkpoint / recovery
```

The diagram is conceptual. A city NPC can direct the party to the world map without requiring the player to walk a character through a tactical grid. A dialogue can launch a scene only through a validated server transition, not because a client navigated to another screen.

### Transition contract

Every transition should define:
- source mode and allowed target mode;
- actor/role permitted to request it;
- preconditions evaluated against current server state;
- whether the transition changes persistent campaign facts;
- event(s) emitted and resulting revision;
- what happens to active dialogue, scene timers, pending commands, and disconnected players;
- client projection and fallback if the transition is rejected.

Reject illegal transitions with a stable error code and no partial mutation. Repeated requests with the same request ID must return the current lifecycle result rather than apply the transition twice.

## 4. World map interaction

### 4.1 What the map displays

Player-facing projection:
- discovered/known regions and nodes;
- route edges that are visible to the party;
- current party location;
- travel status and available destination choices;
- public route hints, known hazards, rumors, and costs only when the campaign has revealed them.

GM projection:
- all authored nodes and routes;
- hidden branches, undiscovered facts, encounter seeds/configuration, trigger conditions;
- lock/unlock controls and campaign annotations.

Never send hidden node names, secret edges, encounter definitions, or future outcomes to player clients and merely hide them in CSS. Server-side projection must omit them entirely.

### 4.2 Nodes and routes

A node should be stable content identity, not a UI coordinate. Suggested conceptual data:
- `nodeId`, `nodeType`, content/version ID;
- public display name/description and GM-only notes as separate fields;
- entry conditions, discovered state, visit state;
- outgoing route IDs;
- optional map-art anchor/coordinates (presentation only);
- optional location/scene entry points.

A route/edge should carry:
- `routeId`, `fromNodeId`, `toNodeId`;
- availability condition and known/hidden state;
- travel cost/duration/risk only if these are real game mechanics;
- any required campaign flags, keys, or GM authorization;
- versioned content identity.

Do not infer route reachability from the visual placement of map icons. Reachability is graph data. A line drawn between two nodes is not automatically a legal route.

### 4.3 Travel is a transaction

Recommended travel flow:
1. Client asks for destinations the party is currently allowed to choose.
2. Player/GM requests a route using stable `routeId` and current campaign revision.
3. Server revalidates source node, destination, route visibility, requirements, party state, and whether another blocking activity is active.
4. If travel needs GM approval, server creates a pending proposal; the GM explicitly accepts/rejects it.
5. On acceptance, one authoritative transition commits: party location, route/travel status, relevant campaign facts, journal event, and checkpoint/persistence boundary.
6. Clients receive new role-filtered projections and a transition result.

A client must not be allowed to send `toNodeId` alone and thereby teleport the party. Reconnect should reconstruct the current location/travel state from server state, not replay a client-side animation as truth.

**Open design choice:** travel may be instantaneous between nodes in the first playable slice. If so, do not introduce travel timers, random encounters, or resource costs until explicitly designed. The data model can leave room for them without pretending they exist.

### 4.4 Discovery and fog of war

Keep separate:
- **exists in authored world**;
- **known to GM**;
- **discovered by party**;
- **currently visible on player map**;
- **visited**.

A rumor may reveal a name or approximate area without revealing a traversable edge. Discovery events must not accidentally unlock a route unless the rule says so. Avoid one boolean such as `isVisible` to represent all these meanings.

## 5. City as a persistent social hub

A city is not a combat scene with all enemies disabled. It is a stable campaign context with services, NPCs, location points, local state, and a return checkpoint.

### 5.1 City content model

A city definition should reference:
- city/node identity and content version;
- districts/locations and their map presentation;
- interaction points (inn, market, guild, healer, trainer, rumor board, gates, etc.) only when authored;
- NPC placements or availability schedules, if schedules are a real mechanic;
- service capabilities and their preconditions;
- city-specific campaign flags and event hooks;
- public descriptions separate from GM-only secrets.

NPCs and services should be content-driven. Avoid hard-coding “all cities have a shop, healer, and quest board.” Different locations can offer different interactions.

### 5.2 What staying in the city means

Proposed city activity categories:
- **observe** — read descriptions, inspect points of interest, view known rumours;
- **talk** — start an NPC dialogue;
- **service** — shop, repair, heal, train, craft, manage equipment, accept a quest; each service is a separate transaction with its own rules and inventory/economy contract;
- **party management** — inspect character state, deck/equipment, and prepare a legal loadout;
- **travel planning** — open the world map and review available routes;
- **depart** — start an expedition after preflight checks.

These categories are not all confirmed game features. They are interaction slots the content system can support. Implement only the services explicitly in scope; an empty/unavailable service should explain why rather than expose a dead button.

### 5.3 City time and safe-state semantics

Do not let city mode become an accidental loophole in combat timers or statuses. Define separately:
- which simulation timers are paused outside an active scene;
- whether city visits restore HP/resources, clear statuses, rotate cards, or only provide a checkpoint;
- what occurs on city entry after retreat, defeat, victory, or GM abort;
- whether the city checkpoint is taken before or after rewards and recovery;
- which changes can be rolled back, and which audit/journal history remains append-only.

Existing Increment 10 has an in-memory city checkpoint/rollback for its headless slice. That does not yet settle the complete product recovery economy. Until a confirmed rule says otherwise, do not assume that “being in town” heals the party, resets every timer, refreshes the deck, or clears every status.

## 6. NPCs and dialogue

Dialogue should be a structured interaction session, not a string of client-side messages and not a hidden mode change.

### 6.1 NPC definition

Separate stable identity, content, and runtime state:
- identity: `npcId`, content version, associated node/location;
- public presentation: name, portrait, public description;
- dialogue graph entry points and authored options;
- interaction preconditions (location, campaign flags, required item, prior event);
- GM-only knowledge, motives, hidden branches, and unrevealed facts;
- runtime facts: disposition/relationship, completed topics, quest flags, if those mechanics are implemented.

Do not store the only copy of important dialogue/quest state in a client. Use stable IDs for topics and choices; display text can be localized or revised without breaking event history.

### 6.2 Dialogue session lifecycle

Proposed lifecycle:
`NOT_ACTIVE → OPENING → CHOICE_PENDING → RESOLVING → CHOICE_PENDING / COMPLETED / ABORTED`.

A session contains:
- `dialogueSessionId`, `npcId`, parent mode/location, initiator and participants;
- dialogue graph/content version;
- current node/topic ID;
- offered choice IDs and expiry/revision if needed;
- authorized audience and visibility;
- status and event/revision reference.

Flow:
1. Player selects an NPC interaction point or “talk” action.
2. Server checks presence/access, NPC availability, campaign phase, participant permission, and whether another blocking dialogue/scene is active.
3. Server opens a dialogue session and sends each role its allowed projection.
4. Player submits a stable `choiceId`, not arbitrary effect payload or an authoritative text string.
5. Server validates that the choice was offered in this session and is still legal.
6. A pure dialogue resolver computes intended effects; server validates and commits state changes/events.
7. Server returns the next dialogue node and refreshed projections.
8. Session ends by explicit completion, a content-defined exit, GM intervention, invalidated preconditions, or disconnect policy.

Do not apply a choice’s effects before validating the choice and its preconditions. A retry must not spend currency, grant an item, set a quest flag, or trigger a scene twice.

### 6.3 Conversation UX and multiplayer

For the first implementation, choose a clear policy rather than accidental behavior:
- **Recommended default:** one active blocking dialogue session per party/campaign; the initiator interacts, other players can observe only the public transcript/projection unless an option explicitly involves them.
- GM can see the full dialogue state and private branches; players see only their authorized branch.
- A dialogue option that requires a group vote or a second character should declare that requirement explicitly.
- If the initiator disconnects, preserve the session for a short configurable grace period or close it deterministically; do not leave the campaign permanently blocked.
- If another player attempts to start a conflicting dialogue, return “dialogue already active” with enough public context to resume/observe, not hidden NPC information.

A more permissive parallel-dialogue model can be added later, but requires per-player sessions and clear rules for shared NPC state races.

### 6.4 GM authority and improvised dialogue

Fable’s product principles make the GM the authority for dialogue and canon. The system should support:
- authored dialogue nodes and deterministic conditional branches;
- GM-entered improvised text;
- optional AI suggestions clearly labelled as suggestions;
- explicit GM approval before AI-generated choices change campaign state, reveal canon, award items, alter relationships, or start an encounter.

Narrative text by itself is not a state-changing command. If the GM says an NPC gives a key, the tool should produce a proposed effect (grant item/flag) for explicit confirmation and validation, not silently parse arbitrary prose into gameplay mutations.

## 7. Transition matrix

| From | Action | To | Required checks / expected behavior |
|---|---|---|---|
| City | Open world map | World map view or `WORLD_MAP` | Read-only map opening should not mutate campaign state. Prefer a view overlay if no planning state is needed. |
| City | Talk to NPC | Dialogue | NPC available at this location; no conflicting blocking interaction; role authorized. |
| City | Use service | City service transaction | Service exists, preconditions/resources pass; commit atomically; return receipt. |
| City | Depart | Preparation or travel confirmation | Party eligible, no unresolved outcome/dialogue, route available; GM approval if required. |
| World map | Select node/route | Route proposal | Destination known/available; stable route ID; no client-side teleport. |
| World map | Confirm travel | Location/scene or city | Revalidate route and party state; commit location and journal event. |
| Location | Inspect point | Location | Read-only, authorized projection; no state change unless the point is explicitly interactive. |
| Location | Talk/interact | Dialogue/service/scene | Authored interaction and preconditions determine destination. |
| Dialogue | Choose option | Dialogue | Choice belongs to active session/current node; effects validated and idempotent. |
| Dialogue | Exit | Parent mode | Close session; retain committed facts; discard only uncommitted proposal state. |
| Dialogue | Trigger authored encounter | Scene | Resolve dialogue transition and scene creation as one coherent commit or recoverable two-phase workflow. |
| Scene | Resolve | Outcome | Existing scene/outcome contract governs results. |
| Outcome | Complete aftermath | City checkpoint or next node | Apply rewards/flags once; save checkpoint at a documented boundary. |
| Any blocking mode | Disconnect/reconnect | Same authoritative mode | Restore projection/session or close by deterministic policy; never infer completion from client disconnect alone. |

## 8. UI and projections

Keep one campaign shell with mode-specific views rather than separate apps that each invent their own state:
- **TV/public display:** public world/location map when relevant; scene grid during tactical scenes; public dialogue and status only.
- **Player phone:** available travel choices, personal character status, current dialogue choices, legal service actions, and clear loading/rejection feedback.
- **GM tablet:** full campaign map, hidden route and NPC facts, session controls, pending proposals, scene transition controls, event journal, and rollback/checkpoint tools.

All three clients subscribe to the same authoritative transition/event stream but receive different projections. Do not share a raw runtime object and rely on UI hiding. Opening a modal, changing tabs, or playing an animation must not mutate the campaign mode.

Use explicit client states such as `idle`, `submitting`, `accepted`, `rejected`, `reconciling`. A pending spinner is not proof of success. On stale revision, refresh the relevant projection and ask the user to retry only if the original request lifecycle is known.

## 9. Suggested command/event vocabulary

These are candidate names, not approved schema changes.

Candidate commands:
- `map.getProjection` (read-only query, not necessarily a domain command)
- `travel.propose`, `travel.confirm`, `travel.cancel`
- `interaction.start`, `interaction.end`
- `dialogue.choose`
- `city.service.request`
- `expedition.depart`
- `scene.enter` only for authorized, validated transitions; do not expose arbitrary scene IDs to players.

Candidate events:
- `party.location.changed`
- `route.discovered`
- `travel.started`, `travel.completed`, `travel.cancelled`
- `interaction.started`, `interaction.ended`
- `dialogue.node.presented`, `dialogue.choice.resolved`, `dialogue.completed`, `dialogue.aborted`
- `city.service.completed`
- `expedition.departed`
- `scene.entered`

Use existing canonical naming conventions and schema versions before adding any of these. Do not introduce one giant `game.action` payload with arbitrary client-controlled effect data.

## 10. Persistence and event consistency

For durable campaigns, treat a meaningful transition as a domain transaction:
- validate current revision and preconditions;
- deduplicate request identity in the proper campaign/actor scope;
- commit state change and domain event(s) together;
- persist dialogue/route/service state that must survive reconnect;
- update projections only from committed state;
- return a stable terminal request result.

For transitions that touch multiple subsystems (e.g. dialogue gives a key and unlocks a route, or outcome awards an item and returns to city), define a single atomic commit or an explicit recoverable workflow. Avoid states such as “key granted but route still locked because the second write failed.”

The current engine’s in-memory journal/checkpoint is not durable persistence. This document does not select a database or prescribe a premature distributed transaction framework; it identifies the consistency boundary the future implementation must satisfy.

## 11. Failure cases that need acceptance tests

At minimum, test:
1. A player cannot travel through a hidden/unavailable edge by guessing a node or route ID.
2. Opening/closing the map is read-only and does not change location or campaign revision.
3. Two players confirm departure concurrently; only one valid transition commits.
4. A route becomes unavailable between projection and confirmation; confirmation is rejected cleanly.
5. Dialogue choice is replayed after timeout; side effects happen once and retry returns terminal result.
6. A choice from an old dialogue node/session is rejected.
7. A hidden dialogue branch, secret route, or GM note is absent from player/TV payloads, reconnect snapshots, and errors.
8. Dialogue starts an encounter, but the server restarts or the client disconnects mid-transition; the campaign recovers to a defined state.
9. Player disconnects during dialogue; the documented grace/close policy is followed.
10. Two players try to use a single NPC/service simultaneously; conflict policy is deterministic.
11. City entry after victory, retreat, defeat, and GM abort uses the correct recovery/checkpoint policy.
12. A service transaction fails validation; no currency/item/equipment mutation is partially applied.
13. Reconnecting in city, on the world map, in dialogue, and during an active scene restores the correct projection and permissions.
14. Replay reproduces the same committed route, dialogue effects, scene entry, and checkpoint sequence for the same versioned content.

## 12. Recommended implementation order

Avoid implementing every screen and every service in one increment.

**Phase A — Contract and state machine**
- Approve parent campaign modes and legal transitions.
- Define route/node identity and discovery semantics.
- Define dialogue session lifecycle and GM authority.
- Decide whether travel is instantaneous and whether the world map is a view overlay or a blocking mode.
- Add transition matrix and failure tests before UI.

**Phase B — Minimal playable loop**
- World map projection with one authored route and a destination confirmation.
- City hub with two explicit points of interest: one NPC dialogue and one departure point.
- Dialogue with a small authored branch and no complex economy.
- One validated transition into the existing headless scene and one return through outcome to city checkpoint.
- Reconnect and role-filtered projections.

**Phase C — Reusable content/services**
- Generic content-driven NPC/dialogue graph.
- Reusable service transaction interface, only for approved services.
- Discovery/rumour model and route unlock flags.
- Campaign journal and GM override/proposal workflow.

**Phase D — Persistence and production hardening**
- Durable transaction boundary, request lifecycle, versioned content, migrations, reconnect recovery.
- Negative visibility tests against serialized payloads.
- E2E tests across phone, TV, and GM tablet.

Do not begin with a full illustrated world map, procedural generation, live NPC AI, real-time city schedules, or a large economy. First prove one end-to-end path with stable state and transitions.

## 13. Open decisions (must be answered before implementation)

1. Is the world map a read-only overlay from city/location or a distinct blocking campaign mode?
2. Is travel instantaneous in the first playable slice, or does it have time, risk, cost, or random encounter mechanics?
3. Can multiple players hold independent dialogue sessions, or is there one blocking party dialogue by default?
4. Does the GM author/approve all consequential dialogue effects, or may approved authored dialogue commit deterministic effects automatically?
5. What exactly happens to HP, stamina, statuses, cards, and timers on city entry and rest?
6. Which city services are in the first playable scope? Do not assume shops, healing, crafting, or training are implemented.
7. What is the checkpoint boundary: on city arrival, after recovery, after rewards, or a deliberately chosen combination?
8. Can a dialogue/service launch a scene directly, and which single commit/recovery rule makes that transition atomic?
9. Which facts are party-shared discovery versus per-character knowledge?
10. What is the timeout/disconnect policy for pending travel approval, dialogue, and service transactions?

## 14. Acceptance principle

A player should be able to complete this full loop without the client inventing state:

`city → open map → choose legal route → confirm travel → enter location/scene → interact/talk → resolve consequence → return to city → reconnect and see the same authoritative result`.

The first vertical slice should prove one narrow version of this loop. Additional city services, route mechanics, NPC schedules, dialogue voting, and AI-driven content remain out of scope until separately specified.
