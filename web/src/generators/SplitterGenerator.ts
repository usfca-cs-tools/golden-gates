import { WireComponentGenerator } from './WireComponentGenerator'
import type { SplitterComponentData, GeneratedStatement } from '../types/ComponentGenerator'

/**
 * Splitter component generator
 * Generates GGL code for splitter components
 */
export class SplitterGenerator extends WireComponentGenerator {
  protected inputBits: number

  constructor(componentData: SplitterComponentData) {
    super(componentData)
    this.inputBits = this.props.inputBits || 8
  }

  generate(): GeneratedStatement {
    const varName = this.generateVarName('splitter')

    // Format splits as tuples: [(0,1), (2,3), (4,5), (6,7)]
    const splitsString = `[${this.ranges.map(range => `(${range.start},${range.end})`).join(', ')}]`

    // Build parameters using centralized method, but handle splits specially
    const additionalParams = {
      bits: this.inputBits
    }

    const baseParams = this.buildGglParams(additionalParams)
    // Insert splits parameter before js_id (which is always last)
    const paramString = baseParams.replace(/, js_id=/, `, splits=${splitsString}, js_id=`)

    return {
      varName,
      code: `${varName} = wires.Splitter(${paramString})`
    }
  }
}
