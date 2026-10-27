# Fable — Step B Reviews

**Статус:** agent review completed / synthesis pending

Шесть независимых агентов проверили разные части Shared Contracts и JSON Schema. Эти отчёты являются review-слоем, а не окончательной заменой confirmed-документов. Перед реализацией их нужно свести в единый Step B decision record.

## Отчёты

1. [Entities](./01-entities.md) — канонические сущности, templates, runtime entities и projections.
2. [Commands](./02-commands.md) — command payloads, preconditions, idempotency и safe errors.
3. [Events](./03-events.md) — event envelope, ordering, replay и rollback metadata.
4. [Visibility](./04-visibility.md) — TV/Player/GM/AI projections и leakage risks.
5. [Versioning](./05-versioning.md) — protocol/schema/ruleset versions и compatibility.
6. [Fixtures](./06-fixtures.md) — valid/invalid fixtures, golden tests и acceptance matrix.

## Общие выводы

- Текущие `command.schema.json` и `event.schema.json` пока слишком generic: typed discriminated unions нужны до реализации server router.
- Нужно разделить `IntentTemplate` и `ActiveIntent`, а также `CardTemplate`, `CardInstance` и `DeckState`.
- Нужно разделить authoritative events и role-filtered transport projections.
- `seed`, exact target, fallback pool, draw pile и audit data никогда не должны уходить TV/Player/AI по умолчанию.
- Нужно согласовать `sceneId` для campaign/session events, canonical event names и semantics `gm.pause_scene`.
- Нужно зафиксировать wire shape rollback с `confirmationToken`, actorId semantics и protocol/schema/ruleset versioning.

## Текущий статус

Эти вопросы пока не переводятся автоматически в `CONFIRMED`: они требуют отдельного решения и Decision Record. Следующая задача — свести шесть отчётов, выбрать baseline и обновить typed JSON Schema.
