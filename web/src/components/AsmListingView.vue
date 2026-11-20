<template>
  <table class="asm-listing">
    <tbody>
      <tr v-for="row in rows" :key="row.key" :class="`row-${row.kind}`">
        <td v-if="row.kind === 'header'" colspan="3" class="listing-header">{{ row.name }}</td>
        <template v-else-if="row.kind === 'label'">
          <td class="listing-addr"></td>
          <td class="listing-word"></td>
          <td class="listing-label">{{ row.name }}:</td>
        </template>
        <template v-else>
          <td class="listing-addr">{{ formatAddress(row.address) }}</td>
          <td class="listing-word">{{ formatWord(row.word) }}</td>
          <td v-if="row.kind === 'continuation'" class="listing-muted"
              :title="$t('chipsROM.pseudoContinuation')">↳</td>
          <td v-else class="listing-src">
            {{ row.code }}<span v-if="row.comment" class="listing-muted listing-comment">{{ row.comment }}</span>
          </td>
        </template>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { computed } from 'vue'
import { buildListingRows } from '../utils/asmListing'

const props = defineProps({
  source: { type: Object, default: null },
  words: { type: Array, default: () => [] },
  wordLines: { type: Array, default: () => [] },
  addressBits: { type: Number, default: 6 }
})

const rows = computed(() => buildListingRows(props.source, props.words, props.wordLines))

// Same formatting as MemoryDataTable 
const formatAddress = a => a.toString(16).toUpperCase().padStart(Math.ceil(props.addressBits / 4), '0')
const formatWord = w => BigInt(w ?? 0).toString(16).toUpperCase().padStart(8, '0')
</script>

<style scoped>
.asm-listing { border-collapse: collapse; width: 100%; font-family: monospace; font-size: 0.75rem; white-space: pre; }
.asm-listing td {
  padding: 0.125rem 0.5rem;
  vertical-align: top;
  border-bottom: 1px solid var(--color-border-light);
}
.asm-listing tr:last-child td { border-bottom: none; }
.listing-addr, .listing-word { border-right: 1px solid var(--color-border-medium); }
.asm-listing tr:hover td { background: var(--color-component-hover-fill); }
.listing-header { padding: 0.25rem 0.5rem !important; font-weight: 600; color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border-medium) !important; }
.listing-label { color: var(--color-text-primary); }
.listing-addr { font-size: 0.625rem; font-weight: 600; opacity: 0.8; text-align: right; color: var(--color-text-secondary); }
.listing-word, .listing-src { color: var(--color-text-primary); }
.listing-muted { color: var(--color-text-muted); }
.listing-comment { margin-left: 1rem; }
</style>

