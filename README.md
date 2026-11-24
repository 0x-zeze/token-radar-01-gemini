[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/0x-zeze/token-radar-01-gemini/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/0x-zeze/token-radar-01-gemini/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Launch Radar (Gemini rebuild)

A token launch radar for the make.fun bounty [token-radar-01](https://make.fun/bounty/token-radar-01): it reads a sealed snapshot of every protocol DefiLlama tracks, works out which ones still record no token, ranks them by what their launch would be worth, and hands in a web dashboard with the board, a detail view for each protocol, and the steps to farm it.

## Value model

The implied value follows from the snapshot's own figures — TVL, seven-day growth, and how long a protocol has run with no token — never from a hardcoded list of names. Every value term is fitted on the token-bearing protocols as peers and tested held-out (walk-forward and leave-one-out); token odds come from the peers' record. The dashboard shows the fits, the test results, and the value equation per row on an integrity strip, so a reader can check the model instead of taking it on trust.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

This writes the ranked board to `out/board.json`, the dashboard data beside the page, copies `dashboard/` and `screenshots/` to `out/`, and writes `out/dossier.json`. It runs with the Node standard library only, no network, and writes the same bytes on every run.
