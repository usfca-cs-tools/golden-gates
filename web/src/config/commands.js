// Insertable-component catalog for the sidebar (grouped by category, with i18n labels).
// Simulation verbs (Run/Step/Stop/Run Tests) and file actions (New/Clear Circuit) now live in the
// native Electron menu bar (see main.cjs), not here.
export const commandGroups = {
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
        id: 'insert-probe',
        labelKey: 'commands.insert.probe',
        componentType: 'probe',
        action: 'addComponent',
        params: ['probe']
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
      },
      {
        id: 'insert-sign-extend',
        labelKey: 'commands.insert.signExtend',
        componentType: 'signExtend',
        action: 'addComponent',
        params: ['signExtend']
      }
    ]
  },
  misc: {
    labelKey: 'commands.groups.misc',
    items: [
      {
        id: 'insert-text',
        labelKey: 'commands.insert.text',
        componentType: 'text',
        action: 'addComponent',
        params: ['text']
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

// Insertable-element category branches for the left sidebar. Static branches come from
// commandGroups (every group is an insertable-element category now) — this reuses the existing
// commands.groups.* i18n labels and the {componentType, action, params} insert shape, and
// automatically excludes the generic schematic-component. The project's own circuits are appended
// as a final "custom" branch (single-click inserts them as a subcircuit); the active circuit is
// filtered out so it can't be inserted into itself.
export function getInsertableGroups(
  availableComponents = [],
  { projectName = null, activeCircuitId = null } = {}
) {
  const staticBranches = Object.entries(commandGroups).map(([key, group]) => ({
    key,
    labelKey: group.labelKey,
    items: group.items.filter(item => !item.separator)
  }))

  const customBranch = {
    key: 'customCircuits',
    label: projectName || null,
    isCustom: true,
    items: getDynamicComponentCommands(availableComponents).filter(
      c => c.params[0] !== activeCircuitId
    )
  }

  return [...staticBranches, customBranch]
}
