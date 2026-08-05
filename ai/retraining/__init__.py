"""Retraining pipeline components (Sprint 4, WBS 4.x — Track B).

Three independent pieces, deliberately kept free of any backend or database
dependency so each can be unit-tested on its own and called from either the
NestJS cron service (WBS 4.3.3) or an offline script:

- ``triggers``   -- when should retraining fire?      (WBS 4.1.2 / 4.4.2)
- ``sampling``   -- which rows go into the snapshot?  (WBS 4.3.6)
- ``promotion``  -- is the new model actually better? (WBS 4.3.7)

Design rationale and the workflow that stitches them together:
``ai/RETRAINING.md``.
"""
