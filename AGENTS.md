# Architecture rules

- Browser capability detection lives in a shared utility and provider consumed by Settings and the global warning, so both surfaces always report the same results.
- Browser warnings remember dismissal for the current session and unsupported-feature set, with an in-memory fallback when storage is blocked.