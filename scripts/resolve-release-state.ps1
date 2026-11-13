# Resolve a release from app.config.json without treating an unpublished version
# as a command error. Can be smoke-tested in PR CI without writing tags/releases.
param(
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  $config = Get-Content -Raw -Encoding utf8 app.config.json | ConvertFrom-Json
  $version = [string]$config.version
  if ($version -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$') {
    throw "app.config.json has an invalid release version: $version"
  }

  $tag = "v$version"
  if (-not $CheckOnly -and -not $env:GITHUB_OUTPUT) {
    throw 'GITHUB_OUTPUT is required when preparing a release.'
  }
  function Set-ReleaseOutput([string]$key, [string]$value) {
    if (-not $CheckOnly) {
      "$key=$value" | Out-File -FilePath $env:GITHUB_OUTPUT -Encoding utf8 -Append
    }
  }
  Set-ReleaseOutput 'tag' $tag

  # "gh release view" fails with non-zero stderr for a missing version,
  # which aborts the PowerShell action with ErrorActionPreference=Stop.
  # Listing releases succeeds even when the target release is absent.
  $releaseJson = gh release list --limit 1000 --json tagName,isDraft
  if ($LASTEXITCODE -ne 0) { throw 'Could not list GitHub releases.' }
  $releases = @($releaseJson | ConvertFrom-Json)
  $existingRelease = $releases | Where-Object { $_.tagName -ceq $tag } | Select-Object -First 1
  if ($null -ne $existingRelease) {
    if ($existingRelease.isDraft) {
      throw "A draft release exists for $tag. Review the incomplete draft before retrying."
    }
    Write-Host "$tag is already published. No duplicate GitHub Release will be created."
    Set-ReleaseOutput 'publish' 'false'
    return
  }

  # Listing Git tags also exits successfully when the requested tag is absent.
  $matchedTags = @(git tag --list -- $tag)
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Git tags.' }
  $tagExists = @($matchedTags | Where-Object { $_ -ceq $tag }).Count -gt 0
  if ($tagExists) {
    $tagCommit = git rev-list -n 1 $tag
    if ($LASTEXITCODE -ne 0 -or -not $tagCommit) { throw "Could not resolve tag $tag." }
    $head = git rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or -not $head) { throw 'Could not resolve HEAD.' }
    if ($tagCommit.Trim() -ne $head.Trim()) {
      throw "Tag $tag points to $tagCommit, not $head. Increase the version instead of moving the tag."
    }
  }

  Write-Host "$tag is eligible for publication (tag exists: $tagExists)."
  Set-ReleaseOutput 'tag_exists' $(if ($tagExists) { 'true' } else { 'false' })
  Set-ReleaseOutput 'publish' 'true'
} finally {
  Pop-Location
}
