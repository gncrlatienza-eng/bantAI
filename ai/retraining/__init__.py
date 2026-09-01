"""Retraining pipeline components (Sprint 4, WBS 4.x — Track B).

Three **policy** modules, deliberately kept free of any backend, database or
filesystem dependency so each can be unit-tested on its own and called from
either the NestJS cron service (WBS 4.3.3) or an offline script:

- ``triggers``   -- when should retraining fire?      (WBS 4.1.2 / 4.4.2)
- ``sampling``   -- which rows go into the snapshot?  (WBS 4.3.6)
- ``promotion``  -- is the new model actually better? (WBS 4.3.7)

and three that do I/O, quarantined here so the purity above survives:

- ``reports``    -- where validated corrections come from (file, backend, none)
- ``snapshot``   -- assembles and writes the training input
- ``pipeline``   -- orchestrates snapshot -> fine-tune -> gate

The split is the point, not an accident of layout: ``triggers``/``sampling``/
``promotion`` encode the decisions the thesis has to defend, and none of them
should become untestable because fetching a report needs a running server.

Design rationale and the workflow that stitches them together:
``ai/RETRAINING.md``.
"""
