# RipperTipper Web

Clean public delivery repository for the RipperTipper website and sanitised prediction snapshots.

## Security boundary

This repository intentionally contains only public-facing website assets and the public prediction contract. Prediction logic, model weights, provider adapters, calibration, back-testing, internal probabilities and private signals belong in the private `RipperTipperEngine` repository and must never be committed here.

Predictions are generated privately and published here as `current_round.json`.

RipperTipper is an independent product and is not affiliated with or endorsed by the AFL or any club.
