// Command palette configuration with i18n support
export const commandGroups = {
  file: {
    labelKey: 'commands.groups.file',
    items: [
      {
        id: 'new-circuit',
        labelKey: 'commands.file.newCircuit',
        icon: 'pi pi-plus',
        action: 'createNewCircuit'
      },
      {
        id: 'clear-circuit',
        labelKey: 'commands.file.clearCircuit',
        icon: 'pi pi-trash',
        action: 'clearCircuit'
      },
      {
        separator: true
      },
    ]
  },
  simulation: {
    labelKey: 'commands.groups.simulation',
    items: [
      {
        id: 'run-simulation',
        labelKey: 'commands.simulation.run',
        icon: 'pi pi-play',
        action: 'runSimulation',
        shortcutKey: 'run'
      },
      {
        id: 'stop-simulation',
        labelKey: 'commands.simulation.stop',
        icon: 'pi pi-stop',
        action: 'stopSimulation',
        shortcutKey: 'stop'
      }
    ]
  },
  logicGates: {
    labelKey: 'commands.groups.logicGates',
    items: [
      {
        id: 'insert-and-gate',
        labelKey: 'commands.insert.andGate',
        componentType: 'and',
        action: 'addComponent',
        params: ['and-gate']
      },
      {
        id: 'insert-or-gate',
        labelKey: 'commands.insert.orGate',
        componentType: 'or',
        action: 'addComponent',
        params: ['or-gate']
      },
      {
        id: 'insert-not-gate',
        labelKey: 'commands.insert.notGate',
        componentType: 'not',
        action: 'addComponent',
        params: ['not-gate']
      },
      {
        id: 'insert-nand-gate',
        labelKey: 'commands.insert.nandGate',
        componentType: 'nand',
        action: 'addComponent',
        params: ['nand-gate']
      },
      {
        id: 'insert-nor-gate',
        labelKey: 'commands.insert.norGate',
        componentType: 'nor',
        action: 'addComponent',
        params: ['nor-gate']
      },
      {
        id: 'insert-xor-gate',
        labelKey: 'commands.insert.xorGate',
        componentType: 'xor',
        action: 'addComponent',
        params: ['xor-gate']
      },
      {
        id: 'insert-xnor-gate',
        labelKey: 'commands.insert.xnorGate',
        componentType: 'xnor',
        action: 'addComponent',
        params: ['xnor-gate']
      }
    ]
  },
  inputOutput: {
    labelKey: 'commands.groups.inputOutput',
    items: [
      {
        id: 'insert-input',
        labelKey: 'commands.insert.input',
        componentType: 'input',
        action: 'addComponent',
        params: ['input']
      },
      {
        id: 'insert-output',
        labelKey: 'commands.insert.output',
        componentType: 'output',
        action: 'addComponent',
        params: ['output']
      },
      {
        id: 'insert-constant',
        labelKey: 'commands.insert.constant',
        componentType: 'constant',
        action: 'addComponent',
        params: ['constant']
      },
      {
        id: 'insert-clock',
        labelKey: 'commands.insert.clock',
        componentType: 'clock',
        action: 'addComponent',
        params: ['clock']
      },
      {
        id: 'insert-test',
        labelKey: 'commands.insert.test',
        componentType: 'test',
        action: 'addComponent',
        params: ['test']
      }
    ]
  },
  wires: {
    labelKey: 'commands.groups.wires',
    items: [
      {
        id: 'insert-splitter',
        labelKey: 'commands.insert.splitter',
        componentType: 'splitter',
        action: 'addComponent',
        params: ['splitter']
      },
      {
        id: 'insert-merger',
        labelKey: 'commands.insert.merger',
        componentType: 'merger',
        action: 'addComponent',
        params: ['merger']
      },
      {
        id: 'insert-tunnel',
        labelKey: 'commands.insert.tunnel',
        componentType: 'tunnel',
        action: 'addComponent',
        params: ['tunnel']
      }
    ]
  },
  plexers: {
    labelKey: 'commands.groups.plexers',
    items: [
      {
        id: 'insert-multiplexer',
        labelKey: 'commands.insert.multiplexer',
        componentType: 'multiplexer',
        action: 'addComponent',
        params: ['multiplexer']
      },
      {
        id: 'insert-decoder',
        labelKey: 'commands.insert.decoder',
        componentType: 'decoder',
        action: 'addComponent',
        params: ['decoder']
      },
      {
        id: 'insert-priority-encoder',
        labelKey: 'commands.insert.priorityEncoder',
        componentType: 'priorityEncoder',
        action: 'addComponent',
        params: ['priorityEncoder']
      }
    ]
  },
  arithmetic: {
    labelKey: 'commands.groups.arithmetic',
    items: [
      {
        id: 'insert-adder',
        labelKey: 'commands.insert.adder',
        componentType: 'adder',
        action: 'addComponent',
        params: ['adder']
      },
      {
        id: 'insert-subtract',
        labelKey: 'commands.insert.subtract',
        componentType: 'subtract',
        action: 'addComponent',
        params: ['subtract']
      },
      {
        id: 'insert-multiply',
        labelKey: 'commands.insert.multiply',
        componentType: 'multiply',
        action: 'addComponent',
        params: ['multiply']
      },
      {
        id: 'insert-divide',
        labelKey: 'commands.insert.divide',
        componentType: 'divide',
        action: 'addComponent',
        params: ['divide']
      },
      {
        id: 'insert-shift',
        labelKey: 'commands.insert.shift',
        componentType: 'shift',
        action: 'addComponent',
        params: ['shift']
      },
      {
        id: 'insert-compare',
        labelKey: 'commands.insert.compare',
        componentType: 'compare',
        action: 'addComponent',
        params: ['compare']
      }
    ]
  },
  memory: {
    labelKey: 'commands.groups.memory',
    items: [
      {
        id: 'insert-register',
        labelKey: 'commands.insert.register',
        componentType: 'register',
        action: 'addComponent',
        params: ['register']
      },
      {
        id: 'insert-rom',
        labelKey: 'commands.insert.rom',
        componentType: 'rom',
        action: 'addComponent',
        params: ['rom']
      },
      {
        id: 'insert-ram',
        labelKey: 'commands.insert.ram',
        componentType: 'ram',
        action: 'addComponent',
        params: ['ram']
      }
    ]
  }
}

// Helper function to get all commands as a flat list for searching
export function getAllCommands() {
  const commands = []
  Object.entries(commandGroups).forEach(([groupKey, group]) => {
    group.items.forEach(item => {
      if (!item.separator) {
        commands.push({
          ...item,
          groupKey,
          groupLabelKey: group.labelKey
        })
      }
    })
  })
  return commands
}

// Helper function to get commands for dynamic circuit components
export function getDynamicComponentCommands(availableComponents) {
  return availableComponents.map(component => ({
    id: `insert-component-${component.id}`,
    labelKey: null, // Use component.name directly
    label: component.name,
    icon: 'pi pi-chip',
    action: 'addCircuitComponent',
    params: [component.id],
    groupKey: 'insert',
    groupLabelKey: 'commands.groups.insert'
  }))
}
