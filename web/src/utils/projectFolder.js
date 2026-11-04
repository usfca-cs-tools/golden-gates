/**
 * Display name of a project folder: its last path segment ("/Users/me/cs315/alu" -> "alu").
 * Handles both / and \ separators and a trailing separator. Empty string for no folder.
 */
export function projectFolderName(dir) {
  if (!dir) return ''
  return dir.split(/[\\/]/).filter(Boolean).pop() || dir
}
