// Writes web/build-info.json, the app's authoritative build identity that the
// About dialog reads back (main.cjs). Runs both in CI (before packaging) and for
// local builds, so a hand-built app is clearly marked "local" rather than faking a
// release. The channel is decided by how the build was triggered:
//
//   tag push (GITHUB_REF_TYPE=tag)  -> channel "release", id = the tag (a real build)
//   main push (any other CI run)    -> channel "dev",     id = <date>-<run> (rolling)
//   no CI                           -> channel "local",   id = "dev"
//
// In CI it also emits `version=<semver>` to $GITHUB_OUTPUT so the workflow can pass
// --config.extraMetadata.version to electron-builder (drives the artifact filename
// and CFBundleVersion). Tags must be semver-ish (vX.Y.Z, e.g. v1.0.0 or CalVer
// v2026.8.2); rolling builds use the semver prerelease 0.0.0-dev.<run>.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function git(args, fallback) {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return fallback
  }
}

const env = process.env
const isCI = !!env.GITHUB_ACTIONS
const refType = env.GITHUB_REF_TYPE // 'tag' | 'branch' (CI only)
const refName = env.GITHUB_REF_NAME || ''
const runNumber = env.GITHUB_RUN_NUMBER || ''
const sha = (env.GITHUB_SHA || git('rev-parse HEAD', 'unknown')).slice(0, 7)
const date = new Date().toISOString()
const ymd = date.slice(0, 10).replace(/-/g, '.') // 2026.08.02

let channel
let id
let version // semver for electron-builder; null = leave package.json version alone (local)

if (isCI && refType === 'tag') {
  channel = 'release'
  version = refName.replace(/^v/, '') // v1.0.0 -> 1.0.0 (must be valid semver)
  id = version
} else if (isCI) {
  channel = 'dev'
  id = `${ymd}-${runNumber}` // e.g. 2026.08.02-57
  version = `0.0.0-dev.${runNumber}` // valid semver prerelease
} else {
  channel = 'local'
  id = 'dev'
  version = null
}

const info = { id, channel, sha, date, runNumber: runNumber || null }
const outPath = path.join(__dirname, '..', 'build-info.json')
fs.writeFileSync(outPath, JSON.stringify(info, null, 2) + '\n')
console.log('Wrote build-info.json:', info)

// Hand the electron-builder version to the workflow (CI, non-local only).
if (version && env.GITHUB_OUTPUT) {
  fs.appendFileSync(env.GITHUB_OUTPUT, `version=${version}\n`)
}
