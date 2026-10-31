import { describe, it, expect, vi } from 'vitest'

vi.mock('@/composables/usePythonEngine', () => ({
  usePythonEngine: () => ({ updateInput: vi.fn() })
}))

import App from '@/App.vue'

// App needs the whole canvas to mount, so run the real watcher against a bare `this`.
const select = (ctx, type) => {
  const oldId = ctx.selectedComponent?.id
  ctx.selectedComponent = type ? { id: `${type}-${++ctx.n}`, type } : null
  App.watch['selectedComponent.id'].call(ctx, ctx.selectedComponent?.id, oldId)
}
const start = inspectorExpanded => ({
  inspectorExpanded,
  inspectorExpandedBeforeSelect: null,
  selectedComponent: null,
  n: 0
})

describe('inspector auto-expand', () => {
  it('expands when a chipsROM is selected', () => {
    const ctx = start(false)
    select(ctx, 'chipsROM')
    expect(ctx.inspectorExpanded).toBe(true)
  })

  it.each([false, true])('restores %s on deselect', before => {
    const ctx = start(before)
    select(ctx, 'chipsROM')
    select(ctx, null)
    expect(ctx.inspectorExpanded).toBe(before)
  })

  it.each([false, true])('restores %s when another component is selected', before => {
    const ctx = start(before)
    select(ctx, 'chipsROM')
    select(ctx, 'rom')
    expect(ctx.inspectorExpanded).toBe(before)
  })

  it('moving between two chipsROMs keeps the original state', () => {
    const ctx = start(false)
    select(ctx, 'chipsROM')
    select(ctx, 'chipsROM')
    expect(ctx.inspectorExpanded).toBe(true)
    select(ctx, null)
    expect(ctx.inspectorExpanded).toBe(false)
  })

  it('a manual collapse holds while selected', () => {
    const ctx = start(false)
    select(ctx, 'chipsROM')
    ctx.inspectorExpanded = false
    App.watch['selectedComponent.id'].call(ctx, ctx.selectedComponent.id, ctx.selectedComponent.id)
    expect(ctx.inspectorExpanded).toBe(false)
  })

  it('does nothing for a component without the flag', () => {
    const ctx = start(false)
    select(ctx, 'rom')
    expect(ctx.inspectorExpanded).toBe(false)
  })
})
