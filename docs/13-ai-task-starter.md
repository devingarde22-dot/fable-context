# Fable — AI Task Starter

**Версия:** 0.2
**Назначение:** шаблон передачи конкретной задачи AI-разработчику на текущем этапе проекта.

Этот документ не означает, что нужно заново начинать Step A, Step B или Step C. Increment 10 / DR-C-010 merged through PR #8; audited current `fable-rpg/main` is now `7770d04` after PR #18. Сначала уточни цель текущей задачи; используй [Current State & Architecture](./26-current-state-and-architecture.md), [verified combat-rules inventory](./29-verified-combat-rules-inventory.md) и current code/tests для маршрутизации, затем работай только с релевантными источниками.

## Task packet

Заполни этот шаблон для конкретной задачи:

```md
# Task: <short name>

## Goal
<one testable sentence>

## Why this is needed
<confirmed bug, requirement, or measurable benefit; if none, do not change anything>

## Current implementation
<what is currently true, with relevant file/test references>

## Normative sources
<confirmed rules, Decision Records, contracts, schemas>

## Allowed files
<exact files or bounded paths>

## Out of scope
<unrelated systems and changes explicitly forbidden>

## Acceptance criteria
- Given ...
- When ...
- Then ...

## Verification
- <specific test/command>
- <replay/determinism/visibility check if relevant>

## Deliver
- changed files and diff summary
- Rule IDs / Decision Records affected
- exact commands run and their actual results
- assumptions / open questions
- remaining risks and known limitations
```

## Default instruction to the implementer

```text
Ты работаешь над Fable как senior engineer.

Не перечитывай весь проект по умолчанию: используй имеющийся контекст и current-state summary, затем открой только те документы, файлы кода и тесты, которые нужны для этой задачи.

Сначала проверь, есть ли реальная проблема или подтверждённая потребность. Если нет — не вноси изменения. Если проблема пока только предполагается, проведи целевую проверку и обозначь неопределённость.

Не придумывай gameplay rules, balance values, production content или новую архитектуру без необходимости. Если подтверждённые нормативные источники противоречат друг другу и конфликт влияет на поведение, верни OPEN_QUESTION с точными ссылками и рекомендуемым решением; не выбирай трактовку молча.

Сохраняй server authority, детерминизм, контрактную валидацию, replay/state-hash parity и visibility boundaries. Изменяй только необходимые файлы. Не выполняй несвязанный рефакторинг и не расширяй scope.

Проверь diff, выполни подходящие тесты и сообщи только фактически выполненные проверки. Не заявляй, что команда прошла, если ты её не запускал.

Не создавай commit, не делай push в main и не сливай PR без явного разрешения пользователя. Работай в feature branch; перед завершением сообщи итоговый статус.
```

## Repository routing

- `fable-rpg`: production code, tests, schemas as consumed by runtime, implementation-specific Decision Records and development handoff.
- `fable-context`: normative context, shared contracts/reference copies, AI guidance and current-state summary.
- `reference/gdd-site/index.html`: visual reference only; not an authoritative gameplay contract.

Если задача касается кода, не изменяй `fable-context` только ради отражения каждой строки кода. Обновляй контекст, когда изменились подтверждённое правило, архитектурная граница, статус этапа, публичный контракт или инструкции разработчику.

## Verification policy

Минимум для изменений в `fable-rpg`: `pnpm check`, `pnpm build` и целевые тесты по изменённому поведению, если эти команды доступны. Для context-only changes: проверить markdown links, ссылки на документы, согласованность статусов и отсутствие противоречий в изменённых разделах. Всегда указывай, что именно было реально проверено.
