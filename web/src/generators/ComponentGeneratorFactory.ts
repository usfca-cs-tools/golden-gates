import type { ComponentGenerator, ComponentData } from '../types/ComponentGenerator'
import { InputGenerator } from './InputGenerator'
import { OutputGenerator } from './OutputGenerator'
import { ConstantGenerator } from './ConstantGenerator'
import { ClockGenerator } from './ClockGenerator'
import { LogicGateGenerator } from './LogicGateGenerator'
import { SplitterGenerator } from './SplitterGenerator'
import { MergerGenerator } from './MergerGenerator'
import { TunnelGenerator } from './TunnelGenerator'
import { MultiplexerGenerator } from './MultiplexerGenerator'
import { DecoderGenerator } from './DecoderGenerator'
import { PriorityEncoderGenerator } from './PriorityEncoderGenerator'
import { RegisterGenerator } from './RegisterGenerator'
import { ROMGenerator } from './ROMGenerator'
import { RAMGenerator } from './RAMGenerator'
import { AdderGenerator } from './AdderGenerator'
import { SubtractGenerator } from './SubtractGenerator'
import { MultiplyGenerator } from './MultiplyGenerator'
import { DivideGenerator } from './DivideGenerator'
import { ShiftGenerator } from './ShiftGenerator'
import { CompareGenerator } from './CompareGenerator'
import { TestGenerator } from './TestGenerator'

/**
 * Options for component generation
 */
export interface ComponentGeneratorOptions {
  isMainCircuit?: boolean // true for main circuit, false for component modules
}

/**
 * Factory function to create the appropriate component generator
 * This is the single place where we switch on component type
 */
export function createComponentGenerator(
  componentData: ComponentData,
  options: ComponentGeneratorOptions = {}
): ComponentGenerator {
  switch (componentData.type) {
    case 'input':
      return new InputGenerator(componentData, options)

    case 'output':
      return new OutputGenerator(componentData)

    case 'constant':
      return new ConstantGenerator(componentData)

    case 'clock':
      return new ClockGenerator(componentData)

    case 'and-gate':
    case 'or-gate':
    case 'xor-gate':
    case 'not-gate':
    case 'nand-gate':
    case 'nor-gate':
    case 'xnor-gate':
      return new LogicGateGenerator(componentData)

    case 'splitter':
      return new SplitterGenerator(componentData)

    case 'merger':
      return new MergerGenerator(componentData)

    case 'tunnel':
      return new TunnelGenerator(componentData)

    case 'multiplexer':
      return new MultiplexerGenerator(componentData)

    case 'decoder':
      return new DecoderGenerator(componentData)

    case 'priorityEncoder':
      return new PriorityEncoderGenerator(componentData)

    case 'register':
      return new RegisterGenerator(componentData)

    case 'rom':
      return new ROMGenerator(componentData)

    case 'ram':
      return new RAMGenerator(componentData)

    case 'adder':
      return new AdderGenerator(componentData)

    case 'subtract':
      return new SubtractGenerator(componentData)

    case 'multiply':
      return new MultiplyGenerator(componentData)

    case 'divide':
      return new DivideGenerator(componentData)

    case 'shift':
      return new ShiftGenerator(componentData)

    case 'compare':
      return new CompareGenerator(componentData)

    case 'test':
      return new TestGenerator(componentData)

    default:
      throw new Error(`Unknown component type: ${componentData.type}`)
  }
}
