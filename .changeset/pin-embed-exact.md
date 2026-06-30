---
"@simplepdf/react-embed-pdf": patch
---

Pin `@simplepdf/embed` to an exact version (`0.6.0`) instead of the `^0.6.0` caret. A published `@simplepdf/react-embed-pdf` now always installs the exact embed build it was tested against, giving us full control over the embed rollout: react ships a known embed version, and moving it is a deliberate release step rather than a caret range resolved at the consumer's install time.
