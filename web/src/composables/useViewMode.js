import { ref } from 'vue'

// App-wide view preference (§11.1): not saved in the .ggc, no undo entry. Default 'listing'.
const STORAGE_KEY = 'gg.chipsRomViewMode'

function load() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'separate' ? 'separate' : 'listing'
  } catch {
    return 'listing'
  }
}

const viewMode = ref(load()) // module-level, so every inspector shares it

// A 1.7 file (no wordLines) can't build a listing and falls back to Separate (§11.4).
export const hasListing = props => !!props.sources?.[0] && (props.wordLines?.length ?? 0) > 0
export const showsListing = props => viewMode.value === 'listing' && hasListing(props)

export function useViewMode() {
  function setViewMode(mode) {
    viewMode.value = mode
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // storage blocked: the preference lasts for this session only
    }
  }
  return { viewMode, setViewMode }
}
