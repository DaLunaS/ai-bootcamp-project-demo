# Patterns Discovered

Accumulate reusable implementation conventions and lessons here. Add patterns only when they are useful beyond one task and supported by current code, tests, or other evidence. Verify examples and related-file links remain accurate as the project changes.

## Pattern Template

Copy this section for a new pattern:

### [Pattern name]

- **Context:** [Where or when this pattern applies]
- **Problem:** [What ambiguity, defect, or maintenance concern it addresses]
- **Solution:** [Recommended convention and any important trade-offs]
- **Example:** [Short, representative code or a concrete usage example]
- **Related files:** [Repository-relative links to implementation, tests, or docs]

---

## Service initialization: empty array vs. null

- **Context:** Initializing a service that owns a collection of records, such as an in-memory repository.
- **Problem:** An absent collection can be confused with a valid collection that currently contains no records, causing unnecessary null checks or unclear behavior.
- **Solution:** Initialize a valid, available collection with an empty array when it has no records. Use `null` only when it conveys a distinct state, such as not-yet-initialized, unavailable, or intentionally absent; document and handle that state explicitly. Match existing project conventions where they are established.
- **Example (illustrative):**

  ```javascript
  class ItemService {
    constructor() {
      this.items = [];
    }

    list() {
      return this.items;
    }
  }
  ```

  With `items` initialized to `[]`, `list()` can consistently return an iterable collection even when it is empty. This is a conceptual example, not a claim about an existing service in this repository.
- **Related files:** Add links to the applicable service/repository implementation and its tests when this pattern is confirmed in the codebase.
