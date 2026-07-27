import { BaseComponentGenerator } from './BaseComponentGenerator'
import type { ComponentData, GeneratedStatement } from '../types/ComponentGenerator'

interface TruthTable {
  inputNames: string[]
  outputNames: string[]
  rows: number[][]
}

/**
 * Test component generator
 *
 * A Test is a verification directive (no connection ports). It holds a truth
 * table over named Inputs/Outputs and emits, e.g.:
 *   test0 = io.Test(label="AND", input_names=["A", "B"], output_names=["Y"],
 *                   rows=[[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]], js_id="...")
 * Each row is a flat list of ints in column order: input columns then output columns.
 */
export class TestGenerator extends BaseComponentGenerator {
  private table: TruthTable

  constructor(componentData: ComponentData) {
    super(componentData)
    const t = (this.props.table || {}) as Partial<TruthTable>
    this.table = {
      inputNames: Array.isArray(t.inputNames) ? t.inputNames : [],
      outputNames: Array.isArray(t.outputNames) ? t.outputNames : [],
      rows: Array.isArray(t.rows) ? t.rows : []
    }
  }

  /** Build a Python list of quoted, escaped strings: ["A", "B"] */
  private buildNameList(names: string[]): string {
    const items = names.map(n => `"${String(n).replace(/"/g, '\\"')}"`)
    return `[${items.join(', ')}]`
  }

  /** Build a Python list of lists of ints: [[0, 0, 0], [1, 1, 1]] */
  private buildRows(rows: number[][]): string {
    const items = rows.map(row => {
      const cells = (Array.isArray(row) ? row : []).map(v => Number(v) || 0)
      return `[${cells.join(', ')}]`
    })
    return `[${items.join(', ')}]`
  }

  generate(): GeneratedStatement {
    const varName = this.generateVarName('test')

    // label + js_id come from the shared base builder (js_id is always last)
    const baseParams = this.buildGglParams()
    const inputNames = `input_names=${this.buildNameList(this.table.inputNames)}`
    const outputNames = `output_names=${this.buildNameList(this.table.outputNames)}`
    const rows = `rows=${this.buildRows(this.table.rows)}`

    // Insert the table params just before js_id (which buildGglParams places last)
    const paramString = baseParams.replace(
      /, js_id=/,
      `, ${inputNames}, ${outputNames}, ${rows}, js_id=`
    )

    return {
      varName,
      code: `${varName} = io.Test(${paramString})`,
      imports: new Set(['io'])
    }
  }
}
