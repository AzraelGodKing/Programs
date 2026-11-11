# Starts a one-job GitHub Actions runner in Docker whenever a trusted Programs job is waiting for one.
# Uses the gh CLI login for API calls; no token is stored anywhere.
param(
    [string]$Repo = "AzraelGodKing/Programs",
    [string]$Label = "grocery-pc",
    [string]$Image = "grocery-runner:latest",
    [int]$PollSeconds = 20,
    [int]$MaxRunners = 2
)

$ErrorActionPreference = "Stop"
$logFile = Join-Path $PSScriptRoot "watcher.log"
function Log($msg) { "$(Get-Date -Format s)  $msg" | Tee-Object -FilePath $logFile -Append | Out-Host }

# Jobs already given a runner, so a slow pickup doesn't start a second container.
$launched = @{}

# Only push/dispatch runs on main, and pull requests from branches inside this repo, may use the PC.
function Test-Trusted($run) {
    if ($run.event -in @("push", "workflow_dispatch")) { return $run.head_branch -eq "main" }
    if ($run.event -eq "pull_request") { return $run.head_repository.full_name -eq $Repo }
    return $false
}

Log "Watching $Repo for jobs labelled '$Label'"
while ($true) {
    try {
        docker info --format "{{.ServerVersion}}" *> $null
        if ($LASTEXITCODE -ne 0) { throw "Docker is not running" }

        $active = @(docker ps --filter "label=gh-ephemeral-runner" --format "{{.ID}}").Count
        $runs = (gh api "repos/$Repo/actions/runs?status=queued&per_page=30" | ConvertFrom-Json).workflow_runs

        foreach ($run in $runs) {
            $jobs = (gh api "repos/$Repo/actions/runs/$($run.id)/jobs?filter=latest" | ConvertFrom-Json).jobs |
                Where-Object { $_.status -eq "queued" -and $_.labels -contains $Label -and -not $launched.ContainsKey($_.id) }
            foreach ($job in $jobs) {
                if (-not (Test-Trusted $run)) {
                    Log "Skipping job $($job.id) ($($run.event) from $($run.head_repository.full_name)): not trusted"
                    $launched[$job.id] = $true
                    continue
                }
                if ($active -ge $MaxRunners) { continue }

                $name = "pc-$($job.id)"
                $body = @{ name = $name; runner_group_id = 1; labels = @("self-hosted", $Label); work_folder = "_work" } | ConvertTo-Json
                $jit = ($body | gh api -X POST "repos/$Repo/actions/runners/generate-jitconfig" --input - | ConvertFrom-Json).encoded_jit_config

                # Passed by name so the config never shows up in a command line.
                $env:RUNNER_JITCONFIG = $jit
                docker run -d --rm --name $name --label gh-ephemeral-runner `
                    -e RUNNER_JITCONFIG -v grocery-gradle-cache:/home/runner/.gradle `
                    --cpus 8 --memory 8g $Image | Out-Null
                Remove-Item Env:RUNNER_JITCONFIG

                $launched[$job.id] = $true
                $active++
                Log "Started runner $name for '$($job.name)' in '$($run.name)' ($($run.event))"
            }
        }
    } catch {
        Log "Error: $_"
    }
    Start-Sleep -Seconds $PollSeconds
}
