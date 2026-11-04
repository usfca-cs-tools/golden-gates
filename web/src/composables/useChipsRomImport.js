import { ref } from 'vue'
import { usePythonEngine } from './usePythonEngine'

export function useChipsRomImport() {
    const { initialize, assembleFiles, isReady } = usePythonEngine()
        // 'idle' | 'loading' (starting Pyodide) | 'assembling'
    const status = ref('idle')

    /**
     * Resolves to { ok: true, sources, words } or { ok: false, errors: [string] }. Never rejects.
     */
    async function importFile(file, addressBits, t) {
        try {
        const text = await file.text()

        if (!isReady.value) {
            status.value = 'loading'
            await initialize()
        }

        status.value = 'assembling'
        const { words, diagnostics } = await assembleFiles([{ name: file.name, text }])

        if (diagnostics) {
            return {
            ok: false,
            errors: diagnostics.map(d => `${d.filename}:${d.line}:${d.column}: ${d.message}`)
            }
        }
        if (words.length === 0) {
            return { ok: false, errors: [t('chipsROM.emptyProgram', { name: file.name })] }
        }
        const capacity = 1 << addressBits
        if (words.length > capacity) {
            return {
            ok: false,
            errors: [
                t('chipsROM.overflow', { name: file.name, words: words.length, addressBits, capacity })
            ]
            }
        }

            return { ok: true, sources: [{ name: file.name, text }], words }
        } catch (err) {
            console.error('CHIPS ROM import failed:', err)
            return { ok: false, errors: [t('chipsROM.importFailed', { name: file.name })] }
        } finally {
            status.value = 'idle'
        }
    }

    return { status, importFile }
}