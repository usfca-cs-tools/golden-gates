import { BaseComponentGenerator } from './BaseComponentGenerator'

/**
 * Generator for Priority Encoder components
 * Creates GGL code for priority encoders with multiple inputs and two outputs (inum, any)
 */
export class PriorityEncoderGenerator extends BaseComponentGenerator {
  private selectorBits: number

  constructor(componentData: any) {
    super(componentData)
    this.selectorBits = componentData.props?.selectorBits || 2
    this.label = componentData.props?.label || 'PE'
  }

  generate() {
    const varName = this.generateVarName('priorityEncoder')

    // Build parameters using centralized method
    const paramString = this.buildGglParams({ selector_bits: this.selectorBits })

    const code = `${varName} = plexers.PriorityEncoder(${paramString})`

    return {
      varName,
      code
    }
  }
}
