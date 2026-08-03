# Vue Frontend Architecture

## GGL Code Generation

This document explains how Golden Gates Language (GGL) code generation works in the Vue frontend.

### Overview

The frontend uses a TypeScript mixin-based architecture to generate GGL Python code from circuit components. This design provides type safety, code reuse through inheritance, and maintains object-oriented principles that mirror the Python GGL implementation.

### Architecture

#### Core Interfaces

**`types/Generatable.ts`**
- `Generatable` - Interface that all components must implement
- `GeneratedStatement` - Return type containing variable name and GGL code
- Provides compile-time contract enforcement

```typescript
interface Generatable {
  generate(): GeneratedStatement
}

interface GeneratedStatement {
  varName: string
  code: string
}
```

#### Factory-Based Architecture

The generation system uses a factory pattern with TypeScript classes that mirror the Python GGL class hierarchy:

```
ComponentGeneratorFactory
├── BaseComponentGenerator (abstract)
│   ├── IOComponentGenerator (abstract)
│   │   ├── InputGenerator
│   │   └── OutputGenerator
│   ├── LogicGateGenerator
│   ├── SplitterGenerator
│   ├── MergerGenerator
│   └── WireGenerator
```

**Base Level:**
- `BaseComponentGenerator` - Common utilities (sequential variable name generation starting from 0, collision-free)

**Category Level:**
- `IOComponentGenerator` - Shared logic for input/output components
- `LogicGateGenerator` - Shared logic for ALL logic gates (AND, OR, XOR, etc.)

**Specific Level:**
- `InputGenerator` - Input component generation
- `OutputGenerator` - Output component generation
- `SplitterGenerator` - Splitter component generation
- `MergerGenerator` - Merger component generation

#### Key Benefits

1. **Code Deduplication**: All logic gates (AND, OR, XOR, NAND, NOR, XNOR, NOT) share the same generation logic in `LogicGateGenerator`

2. **Type Safety**: TypeScript enforces that all generators implement the `ComponentGenerator` interface

3. **Inheritance**: Classes inherit from each other, reducing duplication at each level

4. **Separation of Concerns**: Vue components handle UI, generator classes handle code generation

### Component Implementation

Vue components focus purely on UI rendering, while code generation is handled by the factory system:

```typescript
// LogicGate.vue
export default defineComponent({
  name: 'LogicGate',
  props: {
    // ... UI props only
  },
  // ... UI methods only
  // No generate() method - handled by factory
})
```

```typescript
// InputNode.vue  
export default defineComponent({
  name: 'InputNode',
  props: {
    // ... UI props only
  },
  // ... UI methods only
  // No generate() method - handled by factory
})
```

### Generated Code Examples

**Input Component:**
```python
input0 = io.Input(bits=1, label="A")
input0.value = 0
```

**Logic Gate:**
```python
and0 = logic.And(bits=1, label="", num_inputs=2)
```

**Output Component:**
```python
output0 = io.Output(bits=1, label="R", base=10)
```

### Code Generation Flow

GGL source is generated in Python by the `ggl.view` module (in the ggl engine), not in
the front end. The Vue side only assembles a geometry-canonical circuit model and hands it
to Pyodide:

1. **Component Data**: Vue components (SFCs + `componentRegistry`) are graphics only. Each
   component serializes its ports as transformed grid coordinates (`portGeometry.js`).
2. **Model Assembly**: `useAppController.buildRunModel` builds a `.ggc`-shaped model from
   the canvas via `buildCircuitData` (the same assembler the save path uses), with nested
   circuits inlined under `schematicComponents`.
3. **Generation (Python, pass 1)**: `usePythonEngine.generateProgramFromModel` runs
   `ggl.view.generate(model, mode)` in Pyodide. `ggl.view` re-derives the netlist from wire
   endpoint / port coordinates and emits a complete GGL program string.
4. **Execution (Python, pass 2)**: `usePythonEngine.executePythonProgram` runs that program
   with top-level `await`; structured `CircuitError`s flow back to Vue via `ggl.callbacks`.

Because `ggl.view` is the single authority for JSON→circuit semantics, headless grading
(`ggl-grade`, used by the autograder) produces identical results from the same `.ggc`.

### Design Principles

1. **Geometry is canonical**: the drawing's grid coordinates are the source of truth;
   connectivity is derived every run, never stored as a netlist.
2. **One code-gen authority**: `ggl.view` (Python) generates GGL for both the editor and the
   headless grader — no parallel front-end generator to drift.
3. **Separation of Concerns**: SFCs draw; `ggl.view` builds circuits.

