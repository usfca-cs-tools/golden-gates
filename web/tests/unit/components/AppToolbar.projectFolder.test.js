import { describe, it, expect, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import AppToolbar from '@/components/AppToolbar.vue'
import { projectFolderName } from '@/utils/projectFolder'

// With several desktop windows open, each toolbar names its project folder so the windows can be
// told apart; hovering shows the full path.
const mountToolbar = currentProjectDir =>
  mount(AppToolbar, {
    props: { circuitTabs: [], activeTabId: '', circuitManager: { currentProjectDir } },
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

describe('AppToolbar project folder label', () => {
  afterEach(() => {
    delete window.electronAPI
  })

  it('shows the folder name, with the full path on hover', () => {
    window.electronAPI = {}
    const label = mountToolbar(ref('/Users/aya/cs315/single-cycle-cpu')).find('.project-folder')
    expect(label.text()).toBe('single-cycle-cpu')
    expect(label.attributes('title')).toBe('/Users/aya/cs315/single-cycle-cpu')
    expect(label.classes()).not.toContain('no-folder')
  })

  it('says no folder is open in an empty window', () => {
    window.electronAPI = {}
    const label = mountToolbar(ref(null)).find('.project-folder')
    expect(label.text()).toBe('ui.noFolderOpen')
    expect(label.classes()).toContain('no-folder')
    expect(label.attributes('title')).toBeUndefined()
  })

  it('updates when the window opens a different folder', async () => {
    window.electronAPI = {}
    const dir = ref('/projects/alu')
    const w = mountToolbar(dir)
    dir.value = '/projects/regfile'
    await w.vm.$nextTick()
    expect(w.find('.project-folder').text()).toBe('regfile')
  })

  it('is not shown in the web build, which has no project folders', () => {
    expect(mountToolbar(ref(null)).find('.project-folder').exists()).toBe(false)
  })
})

describe('projectFolderName', () => {
  it('takes the last path segment for / and \\ paths, ignoring a trailing separator', () => {
    expect(projectFolderName('/Users/aya/cs315/alu')).toBe('alu')
    expect(projectFolderName('/Users/aya/cs315/alu/')).toBe('alu')
    expect(projectFolderName('C:\\Users\\aya\\cs315\\alu')).toBe('alu')
    expect(projectFolderName('')).toBe('')
    expect(projectFolderName(null)).toBe('')
  })
})
