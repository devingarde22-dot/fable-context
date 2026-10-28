# Fable — World Content, NPC and Dialogue Graph Model

**Date:** 2026-10-28  
**Status:** UNCONFIRMED PROPOSAL. No production content schema, gameplay mechanic, or event contract is changed by this document.  
**Purpose:** define a small reusable data model so map nodes, routes, city points of interest, NPCs and dialogue can be authored without hardcoding story logic into UI components.

## 1. Design principles

1. **Stable IDs, editable prose.** All references use stable IDs. Localized display text can be changed without breaking saves, requests, replay or dialogue history.
2. **Data drives content.** The coordinator interprets validated content; it does not contain a switch statement for every NPC or city.
3. **Closed effect vocabulary.** Dialogue and services may request only explicitly supported effect types. Do not permit arbitrary JavaScript, SQL, or client-supplied effect JSON.
4. **Conditions are pure.** Condition evaluation reads a snapshot of current authoritative campaign state and returns true/false/reason. It cannot mutate state or consume RNG.
5. **Effects are commands to the domain, not prose parsing.** The server validates each effect and emits domain events only after successful commit.
6. **Public and GM-only fields are separate.** Do not store private notes beside public fields in a single DTO that gets sent to players.
7. **Content versions are immutable for a running campaign.** A text edit can create a new bundle version, but active campaign history references the content version it started with.
8. **No speculative economy.** First slice needs only a rest point, one story NPC, one rumor/route hint and one departure point. Shop inventory, gold, crafting, equipment transactions and quest reward items are deferred.

## 2. Content bundle and identifiers

Every released content bundle should have:
- immutable `contentBundleId` and semantic version;
- schema version and publication status;
- content dependencies and hashes for replay compatibility;
- catalog of cities/locations, nodes, routes, points of interest, NPCs, dialogue graphs and scene templates;
- validation results at publish/load time.

IDs should use a documented namespace convention, for example:
- `city.mirevalt`
- `node.old_road_gate`
- `route.mirevalt_to_old_road`
- `poi.mirevalt.inn`
- `npc.innkeeper_01`
- `dialogue.innkeeper_intro`
- `dialogue_node.innkeeper_intro.opening`
- `scene.quarantine_gates`

These IDs are examples only; use the existing canonical IDs/content catalog where it exists. Never use a display label, array index, translated string, or UI coordinate as an entity ID.

## 3. World nodes and routes

### 3.1 Node model (conceptual)

```ts
type WorldNode = {
  nodeId: string;
  nodeType: "city" | "location" | "camp" | "dungeon" | "site";
  contentVersion: string;
  publicTextKey: string;
  gmNotesKey?: string; // never included in player/TV projection
  entryPolicy: "direct" | "gm_approval" | "scene_approval";
  poiIds: string[];
  routeIds: string[];
  initialDiscovery: "known" | "unknown";
  repeatPolicy: "repeatable" | "one_time" | "closed_after_completion";
};
```

The exact TypeScript type is illustrative. The real schema should be a closed JSON Schema with no unexpected properties. Separate authored definition from runtime facts: a node's type and authored POI references are content; whether a party discovered/visited/completed it belongs to campaign state.

### 3.2 Route model

```ts
type WorldRoute = {
  routeId: string;
  fromNodeId: string;
  toNodeId: string;
  contentVersion: string;
  availability: ConditionExpr[];
  discovery: "visible_when_known" | "gm_only_until_revealed";
  entrySceneTemplateId?: string;
  travelModel: "instant"; // first-slice default
};
```

First-slice rule: routes are instantaneous and have no time, cost, supply usage, encounter chance, or RNG. These are deferred mechanics, not zero-valued hidden systems.

Route visibility, route selection, route eligibility and route confirmation are four different things:
- the route may exist in authored content;
- the party may or may not know it;
- it may be shown but currently blocked by a condition;
- the server may accept or reject a specific confirmation at the current revision.

An authored line on a map is not proof a route is valid. The server validates graph adjacency and conditions from the content bundle.

### 3.3 Discovery model

Suggested independent runtime facts:
- `nodeKnownToParty`;
- `routeKnownToParty`;
- `nodeVisitedByParty`;
- `nodeCompletedByParty`;
- `campaignFact` / `storyFlag`.

Default for first slice: route and location discoveries are party-shared. Character-specific knowledge is deferred. A rumor can reveal a node name or descriptive hint without making a route traversable. Only a declared effect such as `discover_route` changes route knowledge; even then, a separate condition may still block travel.

Do not compress discovery, visibility, reachability and completion into one boolean.

## 4. Cities and points of interest

A `CityDefinition` references a world node and contains a list of point-of-interest IDs, not hardcoded UI buttons. A POI specifies:
- `poiId`, owning node, display text key and optional illustration/anchor;
- supported interaction type: `dialogue`, `rest`, `service`, `departure`, `inspect`;
- activation conditions and visibility policy;
- target NPC/dialogue graph/service definition where applicable;
- whether the interaction blocks other party activity;
- whether a GM approval may be required.

The first slice should include only these three functional POIs:
1. **Story NPC:** starts a shared authored dialogue.
2. **Inn/rest:** performs conditional HP recovery.
3. **Departure point:** switches the campaign into the world-map mode.

A POI can exist but be unavailable. The client must show a safe explanation where possible and never silently disable all feedback. If an interaction is deferred, do not render it as an active control.

## 5. NPC definition and runtime state

Separate immutable definition from mutable campaign facts.

### Definition
- `npcId`, content version and owning node/POI;
- public name, portrait, public description;
- allowed dialogue entry graph IDs;
- interaction conditions;
- audience/visibility rules;
- GM-only background, motives, hidden knowledge and private branches;
- optional authored display state/placement.

### Runtime facts (only when needed)
- NPC disposition/relation key;
- one-time introduction completed;
- campaign flags raised by prior dialogue;
- unavailable/retired state;
- last interaction/event reference.

Do not track arbitrary simulation of NPC location, daily schedules, emotional stats, full memory embeddings or AI-generated biographies in the first slice. NPC schedules and free-roaming movement are explicitly deferred. If no runtime fact is needed, do not create a mutable NPC record just because an NPC exists.

An NPC interaction is available only when all conditions pass: party is at the right node/POI, NPC is not already in a conflicting session, campaign state permits the interaction, and user has an authorized active campaign role.

## 6. Dialogue graph model

A dialogue is a directed graph, not a sequence of array offsets.

### 6.1 Dialogue definition (illustrative)

```ts
type DialogueGraph = {
  dialogueId: string;
  contentVersion: string;
  startNodeId: string;
  nodes: DialogueNode[];
};

type DialogueNode = {
  nodeId: string;
  speakerId: string;
  publicTextKey: string;
  gmNotesKey?: string;
  visibility: "public" | "gm_only" | "conditional";
  conditions: ConditionExpr[];
  choices: DialogueChoice[];
  exitPolicy: "continue" | "allow_exit" | "request_scene" | "complete";
};

type DialogueChoice = {
  choiceId: string;
  labelKey: string;
  conditions: ConditionExpr[];
  nextNodeId?: string;
  effects: DialogueEffect[];
  transition?: { kind: "request_scene"; sceneTemplateId: string };
};
```

This is a proposed model, not a schema to code verbatim without review. All schemas should reject unknown fields and validate every reference at publish/load time.

### 6.2 Choice semantics

- A choice is offered only if its condition is true at the current campaign revision.
- The client submits `choiceId`; it does not submit resulting flags, scene IDs outside the offered set, reward values or arbitrary effect payloads.
- A choice can target the next dialogue node, end the dialogue, or create a pending scene-entry request.
- If multiple choices are available, their order is explicitly authored and stable; do not derive order from map/hash iteration.
- If no public choices remain, content validation must require either a defined terminal node or a visible, safe fallback/GM intervention route.
- Translation changes `labelKey` resolution, not `choiceId`.
- A submitted choice is evaluated once against the session's current node and revision. A stale choice is rejected; do not silently reinterpret it against the next node.

### 6.3 First-slice dialogue policy

- One blocking shared dialogue session per campaign.
- The initiator is the default choice submitter for that dialogue; the GM can take over or close it.
- All players see the same public text/current node and offered public choices, synchronized from server state.
- Other players cannot create a parallel conversation with the same party NPC while the shared session is active.
- Group voting is deferred. If added later, it must define electorate, quorum, timeout, abstention and tie behavior.
- Disconnect does not vote, choose, advance, or confirm on behalf of the player.
- Session ends explicitly, at a terminal node, at an approved scene transition, by GM close, or on defined campaign shutdown handling. Do not end merely because one browser tab closes.

## 7. Condition expression vocabulary

Conditions must be declarative, typed and side-effect-free. Proposed initial operators:
- `has_campaign_flag(flagId)`;
- `has_discovered_node(nodeId)`;
- `has_discovered_route(routeId)`;
- `has_visited_node(nodeId)`;
- `npc_fact_equals(npcId, factId, value)`;
- `hero_has_status(heroId, statusKey)` only where the scenario explicitly has access to that hero fact;
- `all`, `any`, `not`.

Do not offer arbitrary code expressions, string-eval, dynamic database expressions, or hidden external requests inside conditions. If an operator needs private hero information, the condition runs on the server and the failure reason is redacted for player-facing feedback.

Condition evaluation should return a structured internal result (pass/fail plus internal reason key) so the same condition can drive validation, test fixtures, and safe GM diagnostics without leaking secret facts to players.

## 8. Dialogue effect vocabulary

Only explicitly supported effect types can change state. Suggested first-slice allowlist:
- `set_campaign_flag` — set a declared boolean/fact key;
- `reveal_rumor` — record a public rumor/fact and send appropriate public text;
- `discover_node` — mark a node known to the party, but does not automatically unlock routes;
- `discover_route` — mark route known, while route eligibility remains separately validated;
- `request_scene_entry` — create a pending GM approval, not an active scene;
- `end_dialogue` — terminal session effect.

Deferred effects:
- grant/remove item; change currency; equipment changes; training; healing except the city-rest handler; skill changes; arbitrary status manipulation; direct HP/stamina writes; instant arbitrary teleport; direct reward unlock; scene outcome selection; rollback.

Effects should be validated as a whole before commit. If a choice declares two effects and the second is invalid, neither should be applied. A committed choice emits events in a stable authored effect order and stores its terminal request result.

## 9. GM-authored content and AI assistance

- Authored dialogue may run deterministic, declared effects when the choice is accepted.
- GM-authored improvised lines are text until explicitly mapped to a valid domain action.
- AI can suggest dialogue text, choices, hidden facts, routes, scene setup and consequences, but suggestions are not content or state until accepted/confirmed by the GM through a structured workflow.
- Any AI-generated scene entry must be a pending proposal and require GM confirmation.
- Do not parse arbitrary natural language like “the guard lets them in” into a route unlock or scene start.
- A GM override must identify the explicit effect and target. It must be permission-checked, journaled, idempotent, and distinguishable from normal player action.

## 10. City rest interaction model

The rest POI has a stable service key such as `service.city_rest`. It displays the proposed result before confirmation:
- hero without `тяжело ранен`: current HP becomes max HP;
- hero with `тяжело ранен`: no full heal; preserve existing heavy-injury rule;
- no change to stamina, unrelated status, deck, timer or currency is implied.

The server recomputes eligibility at commit time. A client cannot submit a health amount. If the party returns from a scene, the campaign coordinator can invoke the same domain recovery handler as part of the return-to-city transaction; reuse one implementation path rather than separate “arrival heal” and “inn heal” formulae.

Avoid ambiguous duplication: a repeated rest/arrival call with the same request ID returns its prior result. A new rest request when all eligible heroes are already at max may be an accepted no-op, but must not produce fake HP events.

Open proposal choice for the first slice: apply the same HP recovery once on city arrival and whenever the party deliberately uses the rest POI. This matches the owner’s broad city-recovery intent while keeping the exact no-other-resource semantics clear.

## 11. Content validation and authoring checks

At content load/publish:
- every referenced node, route, POI, NPC, dialogue graph, dialogue node and scene template exists;
- all IDs are unique in their namespace;
- route graph does not contain invalid source/destination references;
- dialogue graph entry exists and all non-terminal branches resolve;
- a scene-request choice has a valid scene template;
- all conditions/effects use an allowlisted operator/kind and valid referenced IDs;
- conditions contain no cycles or arbitrary code;
- public text is present for every player-visible branch;
- every GM-only field is separately tagged;
- the content bundle/version is immutable for active campaigns;
- there is an explicit fallback for unavailable NPC/POI or conditionally hidden choice;
- no route becomes reachable solely by UI coordinates or unvalidated label text.

Report validation errors with content IDs and safe paths. Do not start a campaign with invalid required content or partially accept an invalid graph.

## 12. Candidate event families (not current schema changes)

Future campaign-level event family examples:
- `campaign.activity_changed`
- `party.location_changed`
- `world.node_discovered`
- `world.route_discovered`
- `travel.confirmed`
- `dialogue.started`
- `dialogue.choice_committed`
- `dialogue.completed`
- `dialogue.aborted`
- `gm_approval.requested`
- `gm_approval.resolved`
- `city.hp_recovery_applied`
- `campaign.checkpoint_created`
- `campaign.aftermath_completed`

These are names for discussion, not permission to add events to the canonical `event.schema.json`. Campaign events should include campaign ID, content/rules version, event ID/version, sequence/group metadata, actor/request linkage, campaign revision before/after where appropriate, and a validated payload. Secret data should be excluded or split into a GM-only audit event, not put into a public event and rely on clients to ignore fields.

## 13. Acceptance tests for data-driven content

1. Unknown IDs and duplicate IDs fail content validation.
2. A route referencing a missing node fails validation.
3. A dialogue graph with a missing next node fails validation.
4. A scene-request choice referencing a missing scene template fails validation.
5. A terminal dialogue path has an explicit completion/exit.
6. A hidden condition is evaluated server-side and does not expose its raw reason to Player/TV.
7. Changing localized display text does not change node/choice identity.
8. A dialogue choice applies all declared effects or none.
9. A scene request creates a pending proposal and no scene before GM approval.
10. Bundle version used in a campaign remains pinned across reconnect/replay.
11. First-slice content has exactly the intended story NPC, rest POI, departure POI, route and destination; deferred mechanics remain absent.
12. The same graph and campaign state produce the same offered choices and committed effect order.
