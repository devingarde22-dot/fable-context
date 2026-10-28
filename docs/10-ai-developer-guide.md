# Fable — AI Developer Guide

**Версия:** 0.2  
**Статус:** CONFIRMED

## 1. Рабочий принцип

Не проси AI «сделать Fable». Дай ему одну конкретную, проверяемую задачу, ограниченный context packet, список разрешённых файлов и acceptance criteria.

Не вноси изменения только потому, что что-то можно улучшить теоретически. Сначала установи, существует ли реальная проблема или подтверждённая потребность. Если нет — не меняй код. Если проблема вероятна, но не подтверждена, выполни целевую проверку и обозначь неопределённость. Не превращай гипотезы и косметические предпочтения в обязательные исправления.

## 2. Context packet template

```md
# Task: <short name>

## Goal
<one testable sentence>

## Current state
<relevant implementation status; link to docs/26-current-state-and-architecture.md>

## Normative sources
- <specific confirmed rule / contract / Decision Record>
- <relevant JSON Schema or acceptance test>

## Rule IDs / Decision Records
- <only relevant IDs>

## Allowed files
- <exact files or bounded directories>

## Forbidden changes
- <unrelated subsystems, gameplay rules, public API, migrations>

## Acceptance
- <observable given/when/then criteria>

## Verification
- <specific commands and scenario tests>

## Deliver
- changed files and diff summary
- Rule IDs / Decision Records affected
- tests and exact commands run
- assumptions and open questions
- determinism/replay/visibility/rollback review where applicable
```

## 3. Agent roles

### Planner
Не редактирует код. Возвращает dependency graph, затронутые Rule IDs, план файлов, риски и только те вопросы, которые действительно блокируют решение.

### Implementer
Пишет код и tests в согласованных пределах. Не меняет confirmed gameplay semantics молча. Не расширяет scope автоматически.

### Reviewer
Проверяет diff против contracts, visibility matrix, schemas и acceptance. Ищет ошибки, утечки, недопустимые state mutations и ненужную сложность.

### Test Agent
Создаёт unit, simulation, replay, visibility и e2e tests для значимых рисков. Не меняет production rules, чтобы тест прошёл.

### Content Agent
Генерирует контент по schema. Не добавляет hidden fields, новые правила, баланс или числовые формулы без подтверждённого решения.

## 4. Mandatory AI response format

```md
## Summary
## Changed files
## Rule IDs / Decision Records affected
## Tests and exact commands run
## Assumptions
## Open questions
## Security / visibility review
## Determinism / replay / rollback review (when relevant)
## Known limitations
```

## 5. Stop conditions

Остановись на затронутом участке и верни `OPEN_QUESTION`, если:
- два подтверждённых нормативных источника противоречат друг другу и выбор меняет поведение;
- задача требует изменения Schema/API, которое не входит в разрешённый scope;
- неизвестно, должен ли field быть public или GM-only;
- требуется новое игровое правило, баланс или production content;
- golden test / expected result не определён;
- rollback, migration или изменение контракта может потерять данные или нарушить совместимость;
- AI proposal требует прямого authoritative state change без серверной проверки и подтверждения.

Не останавливай всю задачу из-за несущественного противоречия, не влияющего на неё; зафиксируй его отдельно.

## 6. Safe prompt

```text
Ты работаешь над Fable как Implementer.

Используй уже предоставленный контекст и current-state summary; не перечитывай весь репозиторий по умолчанию. Найди только конкретные нормативные источники, код и тесты, необходимые для поставленной задачи.

Сначала определи, есть ли реальная проблема или подтверждённая потребность. Если нет, не меняй код и кратко объясни почему. Если проблема вероятна, но не подтверждена, проведи целевую проверку.

Не придумывай новые gameplay rules, balance или production content. Если подтверждённые нормативные источники конфликтуют и конфликт влияет на решение, верни OPEN_QUESTION с точными ссылками и рекомендуемым вариантом, не выбирая трактовку молча.

Сервер — источник истины. Клиент и AI не рассчитывают и не применяют authoritative gameplay outcomes. Сохраняй детерминизм, контрактную валидацию, replay и visibility boundaries.

Изменяй только файлы, необходимые для задачи. Не расширяй scope, не выполняй несвязанный рефакторинг, не создавай абстракции без практической необходимости. После изменения проверь diff и запусти подходящие тесты. Не заявляй о проверках, которые не выполнялись.

В финале верни Summary, Changed files, Rule IDs/Decision Records, Tests and commands, Assumptions, Open questions, Security/visibility review, Known limitations.
```

## 7. Code review checklist

- [ ] Нет authoritative state mutation в UI/client/AI.
- [ ] Server проверяет ownership, role, phase, revision и доступность действия.
- [ ] Command описывает намерение, а не рассчитанный исход.
- [ ] Команда атомарна; rejected command не оставляет своих gameplay mutations.
- [ ] Принятые действия не откатываются из-за последующего rejected action в той же input window.
- [ ] Event order, revision и sequence соответствуют контракту.
- [ ] Retry / duplicate request не дублирует эффект там, где гарантирована идемпотентность.
- [ ] Visibility фильтруется до сериализации; нет утечек через ошибки, journal или debug projections.
- [ ] Seed/RNG/timers и обход коллекций детерминированы.
- [ ] Replay и state hash совпадают для поддерживаемого сценария.
- [ ] Rollback сохраняет append-only history и не переиспользует sequence/revision.
- [ ] Schema, implementation и tests обновлены согласованно.
- [ ] Нет секретов/API keys в repository или client bundle.
- [ ] Diff не содержит несвязанных изменений.

## 8. Work order

Используй roadmap как последовательность зависимостей, а не как разрешение реализовывать все будущие слои. На текущем этапе Increment 10 уже merged; не начинай следующий increment автоматически. Сначала работай над конкретной пользовательской задачей или одобренным планом стабилизации. UI, transport, persistence, authentication, deployment и AI Copilot остаются отдельными scope и не должны незаметно добавляться в headless rules.

## 9. Definition of a good AI contribution

Хорошая contribution мала, проверяема и обратима. Можно ответить:
- какую реальную проблему она решает;
- какое правило/контракт реализует;
- какой event создаёт и кто его видит;
- какой тест доказывает результат;
- что происходит при retry/reconnect/rollback;
- какие файлы и подсистемы не затронуты.
