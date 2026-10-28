# Fable — Combat Targeting Audit

**Review date:** 2026-10-28  
**Status:** source-inspection finding; no code changes to `fable-rpg`, no test/build execution, no runtime reproduction.  
**Scope:** `packages/rules/src/intents/targeting.ts` and existing intent/Ally Guard integration tests.

## Finding CT-01 — Target policies score the first ID-sorted candidate instead of the best-scoring candidate

**Priority: P1 — gameplay correctness.**

In `selectIntentTarget()`, each policy obtains candidates from `rankedCandidatesForPolicy()`. For all policies except `current_target`, that helper sorts candidates lexicographically by entity ID. The caller then calculates `topScore` from `candidates[0]` and filters the candidate set to those with that same score.

This does not find the best score across candidates. It finds candidates tied with whichever eligible entity happens to sort first by ID. As a result:
- `nearest_player` / `nearest_visible_player` can select a farther player if the lexicographically first player is farther away.
- `highest_threat` can select a lower-threat player if the first player's threat is not maximal.
- `lowest_ally_hp_percentage` can select an ally with more remaining health if the first ally's health ratio is not the minimum.

The RNG tie-break itself is deterministic, but the candidate set passed to it may be the wrong set. This is a direct source-level logic defect, not merely a replay/versioning risk.

## Existing test coverage observed

`packages/rules/tests/intents.integration.test.ts` tests `highest_threat` with two heroes that have equal threat. That verifies seeded tie-breaking and reproducibility but does not distinguish the best score from a worse score. `packages/rules/tests/ally-guard.integration.test.ts` verifies `lowest_ally_hp_percentage` with a single eligible ally, which cannot expose the scoring issue. In the inspected snippets, there is no non-tied ranking test that proves the optimal candidate wins for each policy.

This is a targeted inspection of the named tests, not a claim that no other test in the repository could exercise these policies indirectly.

## Recommended correction

Compute the policy score for every candidate, determine the optimal score according to the policy, then apply seeded randomness only among candidates whose score equals that optimum. Keep entity-ID sorting as a stable candidate ordering before RNG selection so the random index maps deterministically to the same candidate list.

For policies where lower is better (`nearest_player`, `nearest_visible_player`, `lowest_ally_hp_percentage`), choose the minimum score. For `highest_threat`, because the current score is `-target.threat`, choose the minimum score as well. Alternatively, use explicit comparators per policy, but document the direction clearly. Preserve the existing `current_target` semantics.

## Regression tests to add

1. **Nearest player:** create two eligible players where the lexicographically first ID is farther away; assert the nearer player is selected.
2. **Highest threat:** make the first ID-sorted candidate have lower threat than a later candidate; assert the highest-threat player is selected.
3. **Lowest ally HP percentage:** create at least two eligible allies with different health ratios and arrange IDs so the first candidate is not the lowest ratio; assert the lowest-ratio ally is selected.
4. **Tie-breaking:** for each policy, provide multiple candidates at the true optimal score and verify same seed/config produces the same selected target.
5. **Replay:** verify the target-selection event and replayed snapshot remain identical after the correction.

## Verification status

Inspected the targeting implementation and the relevant existing tests. No tests/build or runtime probes were executed. This recommendation should be validated with focused tests before changing implementation. It does not change game rules by itself; it restores the likely intended semantics of the existing named target policies.
