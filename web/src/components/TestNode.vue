<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Test box (no connection points - a Test is a verification directive) -->
    <rect
      x="0"
      y="0"
      :width="boxWidth"
      :height="boxHeight"
      :fill="fillColor"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      :class="componentClasses"
      rx="3"
      @mousedown="handleMouseDown"
    />

    <!-- Label (top-left inside the box) -->
    <text x="6" :y="GRID_SIZE - 4" text-anchor="start" font-size="12" class="component-label">
      {{ label }}
    </text>

    <!-- Status badge (top-right inside the box). Failure DETAIL is surfaced via
         the shared structured-error path (component highlight + message). -->
    <circle
      :cx="boxWidth - GRID_SIZE / 2 - 2"
      :cy="GRID_SIZE / 2 + 1"
      :r="GRID_SIZE / 2 - 1"
      :fill="badgeFill"
    />
    <text
      :x="boxWidth - GRID_SIZE / 2 - 2"
      :y="GRID_SIZE / 2 + 5"
      text-anchor="middle"
      font-size="12"
      font-weight="bold"
      fill="#ffffff"
    >
      {{ badgeGlyph }}
    </text>

    <!-- Column-name header (inputs | outputs) -->
    <text
      v-if="headerText"
      x="6"
      :y="GRID_SIZE * 2 - 3"
      text-anchor="start"
      font-size="9"
      class="component-label"
    >
      {{ headerText }}
    </text>

    <!-- Truth-table value rows -->
    <text
      v-for="(rowText, index) in rowTexts"
      :key="index"
      x="6"
      :y="GRID_SIZE * 3 + index * GRID_SIZE - 3"
      text-anchor="start"
      font-size="9"
      class="component-value"
    >
      {{ rowText }}
    </text>
  </g>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { GRID_SIZE } from '../utils/constants'

interface TruthTable {
  inputNames: string[]
  outputNames: string[]
  rows: number[][]
}

export default defineComponent({
  name: 'TestNode',
  props: {
    ...draggableProps,
    label: { type: String, default: 'TEST' },
    table: {
      type: Object,
      default: () => ({ inputNames: [], outputNames: [], rows: [] })
    },
    // 'pass' | 'fail' | 'pending' (failure detail comes via the error path)
    status: { type: String, default: 'pending' }
  },
  emits: ['startDrag'],
  setup(props, { emit }) {
    const { handleMouseDown, fillColor, strokeColor, strokeWidth, componentClasses } =
      useComponentView(props, emit)

    const tbl = computed<TruthTable>(() => {
      const t = (props.table || {}) as Partial<TruthTable>
      return {
        inputNames: Array.isArray(t.inputNames) ? t.inputNames : [],
        outputNames: Array.isArray(t.outputNames) ? t.outputNames : [],
        rows: Array.isArray(t.rows) ? t.rows : []
      }
    })

    const columnCount = computed(
      () => tbl.value.inputNames.length + tbl.value.outputNames.length
    )
    const rowCount = computed(() => tbl.value.rows.length)

    const headerText = computed(() => {
      const { inputNames, outputNames } = tbl.value
      if (inputNames.length === 0 && outputNames.length === 0) return ''
      const ins = inputNames.join(' ')
      const outs = outputNames.join(' ')
      return `${ins}${ins ? ' ' : ''}| ${outs}`.trim()
    })

    const rowTexts = computed(() => {
      const nIn = tbl.value.inputNames.length
      return tbl.value.rows.map(row => {
        const ins = row.slice(0, nIn).join(' ')
        const outs = row.slice(nIn).join(' ')
        return `${ins}${ins ? ' ' : ''}| ${outs}`.trim()
      })
    })

    // Box grows to fit the widest text line and all rows.
    const boxWidth = computed(() => {
      const lines = [String(props.label), headerText.value, ...rowTexts.value]
      const maxChars = lines.reduce((m, s) => Math.max(m, (s || '').length), 0)
      return Math.max(GRID_SIZE * 5, maxChars * 6 + GRID_SIZE * 2)
    })
    const boxHeight = computed(() => {
      const contentRows = (columnCount.value > 0 ? 1 : 0) + rowCount.value
      return Math.max(GRID_SIZE * 3, GRID_SIZE * (contentRows + 2))
    })

    const badgeFill = computed(() => {
      if (props.status === 'pass') return '#22c55e' // green
      if (props.status === 'fail') return '#ef4444' // red
      return '#9ca3af' // neutral (pending)
    })

    const badgeGlyph = computed(() => {
      if (props.status === 'pass') return '✓' // check
      if (props.status === 'fail') return '✗' // cross
      return '?'
    })

    return {
      handleMouseDown,
      fillColor,
      strokeColor,
      strokeWidth,
      componentClasses,
      boxWidth,
      boxHeight,
      headerText,
      rowTexts,
      badgeFill,
      badgeGlyph,
      GRID_SIZE
    }
  }
})
</script>

<style scoped>
@import '../styles/components.css';
</style>
