// electron-builder afterSign hook: submit the signed .app to Apple for notarization.
//
// INERT BY DEFAULT. It only runs when the Apple credentials are in the environment
// (APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID). Until those secrets exist,
// it's a clean no-op, so builds stay ad-hoc/unnotarized exactly as before. Notarization
// also requires the app to be Developer-ID signed with the hardened runtime — the CI
// workflow arranges both (see .github/workflows/build-desktop.yml) for tagged releases.
//
// To activate: add the CSC_LINK / CSC_KEY_PASSWORD / APPLE_* repository secrets (see the
// README "Code signing" section) and cut a tag. Nothing else changes.
const { execFileSync } = require('node:child_process')

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('[notarize] Apple credentials not set — skipping notarization (ad-hoc build)')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`
  const appBundleId = context.packager.appInfo.id // com.goldengates.app

  const { notarize } = require('@electron/notarize')
  console.log(`[notarize] submitting ${appName}.app to Apple (this can take a few minutes)…`)
  await notarize({
    appBundleId,
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  })
  // Staple the ticket so Gatekeeper accepts the app offline (no online check on launch).
  console.log('[notarize] stapling ticket…')
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
  console.log('[notarize] done')
}
