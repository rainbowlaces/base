---
"@rainbowlaces/base": patch
"@rainbowlaces/create-base": patch
---

- Base: streamlined graceful shutdown (removed verbose diagnostics, simplified signal handling, cleaner uncaught exception / unhandled rejection logging).
- Request handler: ordered teardown (terminate WS clients, remove listeners, close WSS, graceful server close with 1.5s safety timer + force-close fallback).
- start command: child process now not detached; receives TTY signals directly. IPC shutdown skipped for real signals; fallback SIGTERM only if IPC unavailable.

- BASE_DEBUG_SHUTDOWN diagnostics block and redundant commentary noise.

- Comment pruning and minor log message normalization.
