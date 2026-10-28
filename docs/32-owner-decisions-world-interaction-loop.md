# Fable — Owner Decisions: World Interaction Loop

**Date:** 2026-10-28  
**Status:** Decision capture / proposed contract. These choices were supplied by the project owner; they should be promoted into confirmed rules or an ADR before implementation.  
**Parent proposal:** `docs/31-world-map-city-dialogue-transitions.md`  
**Scope boundary:** `fable-context` documentation only. No gameplay source changes.

## 1. Decisions supplied by the owner

1. **World map is a distinct mode.** It is not merely a city UI overlay. Opening it transitions the campaign from `CITY` to `WORLD_MAP`; returning without travel restores the prior city context. Confirmed travel changes authoritative party location.
2. **NPC dialogue is shared by the party.** The first slice uses one blocking dialogue session per party/campaign, not independent simultaneous conversations for each player. The server maintains one current dialogue node and distributes role-filtered projections.
3. **City HP recovery is conditional.** When the party arrives/rests in the city, a hero without the `тяжело ранен` debuff recovers HP to maximum. A hero with that debuff does not receive full HP recovery. Do not clear the debuff simply because the party entered the city. This city HP rule alone does not restore stamina, reset the deck, clear unrelated statuses, or reset timers; battle-end cleanup is a separate rule below.
4. **Initial city scope is delegated to architecture.** Recommended first slice: one story NPC with a short branching conversation and rumor/route hint; one inn/rest point implementing the HP rule; one departure point; one route; one scene and a return-to-city path. Defer shops/economy, crafting, training, NPC schedules, travel timers/random encounters, dialogue voting, and live AI NPCs.
5. **A dialogue-triggered scene requires GM confirmation.** The dialogue may produce a pending scene-entry proposal, but the scene is not entered until the GM confirms. On confirmation, the server revalidates campaign revision and all scene-entry conditions; stale confirmation must not partially mutate state. Ordinary authored dialogue effects that do not start a scene may resolve automatically if they are declared in content and validated by the server.
6. **Battle-only runtime state resets immediately when battle ends.** As soon as a terminal battle outcome is committed, discard combat stamina state, reset tactical deck containers to the canonical pre-battle loadout/initialization, and remove every status explicitly scoped to that battle. Do this for every terminal outcome, before the campaign continues to city recovery/checkpoint handling. Persistent campaign statuses—including the separate `тяжело ранен` debuff—are not cleared by this rule. The next battle starts from the existing combat-entry rules, including the baseline 3 stamina; spent stamina, hand/discard order, combat-only card instances and temporary battle effects do not carry into it.

## 2. Recommended first playable loop

```text
CITY
  ├─ talk to story NPC ─> shared DIALOGUE
  │                         ├─ ordinary choice ─> next dialogue node / committed fact
  │                         └─ scene requested ─> pending GM confirmation
  │                                                  ├─ reject ─> dialogue/city context
  │                                                  └─ accept ─> SCENE
  ├─ use inn/rest ─> conditional HP recovery ─> CITY checkpoint
  └─ departure point ─> WORLD_MAP (distinct mode)
                           ├─ cancel ─> CITY
                           └─ confirm legal route ─> LOCATION / SCENE
                                                       └─ OUTCOME
                                                            └─ rewards
                                                                 └─ city HP recovery
                                                                      └─ CITY checkpoint
```

Treat this as the target user journey, not proof that the path is implemented. The existing headless campaign loop remains the source for current scene/outcome semantics.

## 3. City recovery rule and edge cases

Recommended deterministic order on successful return to city:
1. Resolve the scene/expedition outcome.
2. Commit rewards and campaign consequences exactly once.
3. Apply the city HP rule to each hero.
4. Create the city checkpoint after recovery.
5. Publish new role-filtered projections.

For each hero:
- If `тяжело ранен` is absent: set current HP to the defined maximum.
- If `тяжело ранен` is present: do not apply full recovery; preserve the existing heavy-wound rule, including its post-battle 1 HP behavior where applicable.
- Do not infer what clears the debuff or how long it lasts; that requires its own confirmed rule.
- The city HP recovery handler itself does not silently restore stamina, reset the deck, clear unrelated statuses, or reset timers.

### Battle-end cleanup (separate from city recovery)

After a terminal battle outcome is committed, immediately clear the battle-scoped runtime:
- discard the just-ended battle's stamina value and regeneration timer; the next battle initializes stamina under the existing combat-entry rule (baseline 3, with maximum derived from the current rules);
- discard battle-specific hand/draw/discard/excluded/defense-slot placement and timed card rotation; rebuild the tactical deck on the next battle from the canonical persistent sources (skills, equipment and other valid non-battle sources), without permanently losing cards;
- remove all status layers explicitly scoped as battle-only, even if their duration timer had not elapsed;
- retain campaign-persistent statuses and consequences, especially the separate `тяжело ранен` debuff; do not confuse temporary battle effects with persistent injury;
- stop battle intents, card-rotation timers and stamina-regeneration timers. No tactical timer may continue after the scene has ended.

Cleanup is part of the terminal battle transition, not an inn/city effect, and must execute exactly once for success, retreat, defeat and GM abort. Existing outcome eligibility and rollback semantics remain unchanged.

Acceptance cases: city arrival with and without the debuff; return after victory, retreat, defeat, and GM abort; battle-end cleanup independent of city arrival; spent stamina is not carried into the next battle; the deck is rebuilt from the canonical loadout; battle-only statuses clear while persistent injury remains; duplicate return/recovery request; reconnect after the recovery commit; rollback to a checkpoint taken after recovery.

## 4. Shared dialogue contract

A dialogue session should carry `dialogueSessionId`, `npcId`, parent context, current node ID, content version, offered choice IDs, status, and revision reference. The server validates that a selected `choiceId` belongs to the active session and current node.

Default policy:
- one blocking dialogue per party;
- one authoritative current node;
- all players receive the same public dialogue state, with role-based filtering for private information;
- group voting is out of scope until explicitly designed;
- disconnect follows a deterministic grace-period/close policy;
- retries never repeat side effects.

If a choice requests a scene, create a pending GM approval record. Do not create the scene or apply scene-entry effects before approval. Approval must revalidate the current revision and preconditions. Rejection returns to a defined parent context without losing already committed dialogue facts or applying pending effects.

## 5. Suggested implementation scope

### Include
- world-map mode with one authored route and cancel/confirm behavior;
- one city story NPC and short branching shared dialogue;
- one inn/rest point with the conditional HP rule;
- one departure point;
- one scene-entry request that waits for GM approval;
- one scene outcome returning the party to city and applying recovery before checkpoint;
- role-filtered TV/player/GM projections and reconnect behavior.

### Defer
- shop and currency economy;
- crafting, training and equipment services;
- NPC schedules and moving crowds;
- random encounters, travel duration and travel costs;
- simultaneous independent dialogue sessions and voting;
- AI autonomously speaking or applying campaign effects.

## 6. Acceptance tests

1. Opening world map changes campaign mode; cancelling returns to the same city and does not move the party.
2. Player cannot travel by guessing a hidden route/node ID.
3. Party members see a synchronized current dialogue node; a second dialogue cannot start concurrently.
4. A choice from an old node/session is rejected.
5. Retrying a dialogue choice does not repeat its effects.
6. Dialogue scene request remains pending until GM confirmation.
7. GM approval after the campaign revision changed is rejected and requires refresh/review.
8. GM rejection does not create a scene or apply scene-entry effects.
9. City recovery sets HP to maximum when `тяжело ранен` is absent.
10. City recovery does not fully heal a hero with `тяжело ранен`.
11. City recovery does not silently restore stamina or clear unrelated statuses.
12. Rewards, recovery, and checkpoint are committed in the documented order and are idempotent.
13. Reconnect restores world-map mode, shared dialogue, pending GM approval, or city state accurately.
14. Player/TV projections never include GM-only dialogue branches or hidden route facts.

## 7. Still unresolved

- Whether a later city-rest feature should restore stamina or affect other statuses/cards/timers (first-slice default: no; battle-end cleanup is separate).
- Exact duration and clearing conditions for `тяжело ранен`; do not invent these.
- Whether discovery is always party-shared or some knowledge is character-specific.
- Exact timeout policy for pending GM approval and disconnected dialogue initiators.
- How defeat/GM abort interact with recovery and checkpointing if current confirmed rules do not fully specify it.

These questions should be answered in the relevant confirmed rules/ADR before production implementation. This file captures the owner's current decisions and recommended scope; it does not itself silently change existing `CONFIRMED` documents.
