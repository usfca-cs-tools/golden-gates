<template>
  <g :transform="`translate(${x * GRID_SIZE}, ${y * GRID_SIZE})`">
    <!-- Selection outline (dashed box shown when the annotation is selected) -->
    <rect
      v-if="selected"
      :x="-4"
      :y="-4"
      :width="Math.max(estWidth + 8, 20)"
      :height="totalHeight + 8"
      fill="rgba(59, 130, 246, 0.08)"
      stroke="rgb(59, 130, 246)"
      stroke-width="1"
      stroke-dasharray="4 2"
      rx="3"
      pointer-events="none"
    />

    <!-- Invisible drag/click hitbox — covers the approximate text bounding box -->
    <rect
      :x="0"
      :y="0"
      :width="Math.max(estWidth, 20)"
      :height="Math.max(totalHeight, fontSize)"
      fill="transparent"
      class="text-annotation-hitbox"
      @mousedown="handleMouseDown"
    />

    <!-- Annotation text — dominant-baseline:hanging so y=0 is the top of the first line -->
    <text
      x="0"
      y="0"
      dominant-baseline="hanging"
      :font-size="fontSize"
      :fill="textFill"
      class="text-annotation-body"
      pointer-events="none"
    >
      <tspan
        v-for="(line, i) in lines"
        :key="i"
        x="0"
        :dy="i === 0 ? '0' : `${fontSize * 1.4}`"
      >{{ line || '​' }}</tspan>
    </text>
  </g>
</template>

<script>
import { defineComponent } from 'vue'
import { useComponentView, draggableProps } from '../composables/useComponentView'
import { COLORS, GRID_SIZE } from '../utils/constants'

export default defineComponent({
  name: 'TextAnnotation',

  props: {
    ...draggableProps,
    /** The annotation content. Newlines (\n) produce multiple lines. */
    text: { type: String, default: 'Text' },
    /** Font size in SVG user-units (pixels at 1× zoom). */
    fontSize: { type: Number, default: 14 }
  },

  emits: ['startDrag'],

  computed: {
    lines() {
      return (this.text || '').split('\n')
    },

    /** Estimated pixel width of the widest line (sans-serif ~0.55 char ratio). */
    estWidth() {
      const maxLen = Math.max(...this.lines.map(l => l.length), 1)
      return maxLen * this.fontSize * 0.55
    },

    /** Total pixel height of all lines at a 1.4× line-height. */
    totalHeight() {
      return this.lines.length * this.fontSize * 1.4
    },

    textFill() {
      if (this.selected) return COLORS.componentSelectedStroke
      return COLORS.componentText
    }
  },

  setup(props, { emit }) {
    const { handleMouseDown } = useComponentView(props, emit)
    return { handleMouseDown, COLORS, GRID_SIZE }
  }
})
</script>

<style scoped>
.text-annotation-hitbox {
  cursor: move;
}

.text-annotation-body {
  user-select: none;
  font-family: inherit;
}
</style>
