# On-demand self-hosted runner (Docker Desktop)

Grocery List builds can run on Azrael's PC instead of GitHub's runners. Nothing runs idle: a
watcher starts a Docker runner when a job is waiting, the runner takes that one job, then
unregisters itself and the container is deleted.

## Parts

- `Dockerfile`: the official GitHub runner image plus JDK 17 and the Android SDK (platform 35).
- `watch-runners.ps1`: polls the repo every 20 seconds. For each queued job labelled
  `grocery-pc` it asks GitHub for a one-time (JIT) runner config and starts a container with it.
  It uses the `gh` CLI login, so no token is stored.

## Who can use the PC

- `grocery-list.yml` (push to main, manual runs) and `grocery-list-check.yml` (PRs from branches
  in this repo) target the PC only when the repo variable `GROCERY_RUNNER` is `pc`.
- Fork PRs always run on `ubuntu-latest`. The watcher also refuses any job that isn't from main
  or a same-repo PR, and outside contributors' workflows need approval before they run.
- Containers mount only the `grocery-gradle-cache` volume, nothing from the host.

## Setup

```powershell
docker build -t grocery-runner:latest tools/self-hosted-runner
gh variable set GROCERY_RUNNER --body pc -R AzraelGodKing/Programs
```

The watcher runs at login as the scheduled task `GitHub runner watcher`. To go back to GitHub's
runners, delete the variable: `gh variable delete GROCERY_RUNNER -R AzraelGodKing/Programs`.
