import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppToolbar from '@/components/AppToolbar.vue'

// Issue #141: the macOS desktop app hides the native title bar, so the toolbar becomes the window
// drag region. Only the Mac Electron build should get the mac-title-bar class; web and Windows
// keep the toolbar exactly as before.
const mountToolbar = () =>
  mount(AppToolbar, {
    props: { circuitTabs: [], activeTabId: '', circuitManager: {} },
    global: {
      mocks: { $t: k => k },
      directives: { tooltip: {} },
      stubs: {
        Toolbar: { template: '<div><slot name="start" /><slot name="end" /></div>' },
        Button: true,
        CircuitTabsBar: true
      }
    }
  })

describe('AppToolbar mac title bar (issue #141)', () => {
  afterEach(() => {
    delete window.electronAPI
    vi.restoreAllMocks()
  })

  it('is the drag region in the macOS desktop app', () => {
    window.electronAPI = {}
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    expect(mountToolbar().classes()).toContain('mac-title-bar')
  })

  it('is unchanged in the web build on a Mac', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    expect(mountToolbar().classes()).not.toContain('mac-title-bar')
  })

  it('is unchanged in the desktop app on Windows', () => {
    window.electronAPI = {}
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32')
    expect(mountToolbar().classes()).not.toContain('mac-title-bar')
  })
})
