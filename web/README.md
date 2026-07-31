# Golden Gates Web Application

A web-based circuit designer and simulator for the Golden Gates Language (GGL).

## Overview

This is a single-page application built with Vue.js 3, Vite, and PrimeVue. The application runs GGL circuit simulations directly in the browser using Pyodide (Python in WebAssembly), providing a complete circuit design and simulation environment without requiring a backend server.

## Features

### Circuit Design
- **Visual Circuit Editor**: Drag-and-drop interface for building digital logic circuits
- **Component Library**: Logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR), input/output nodes, splitters, and mergers
- **Grid-based Canvas**: Precise component placement with 15px grid snapping
- **Wire Management**: Visual wire drawing with junction support for complex routing
- **Hierarchical Circuits**: Save circuits as reusable components and create complex hierarchical designs

### Simulation
- **Real-time Simulation**: Execute circuits directly in the browser using Pyodide
- **Interactive Components**: Click inputs to change values and see outputs update instantly
- **Hierarchical Execution**: Automatically handles component dependencies and imports
- **No Backend Required**: Everything runs client-side in the browser

### File Management
- **Project-based Workflow**: Open a cloned git repository as a project directory; each `.ggc` file in the directory is a circuit
- **Save Circuits**: Cmd+S (or File → Save) writes the active circuit directly to the project directory — no dialog
- **Component Library**: Save custom circuits as reusable components
- **Desktop File Association**: On macOS and Windows, double-clicking a `.ggc` file opens its parent directory as the project automatically

## Setup Instructions

1. Navigate to the web directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   The application will be available at http://localhost:3000

## Building for Production

Build the static files:
```bash
npm run build
```

The built files will be in the `dist` directory. They are bundled into the Electron desktop app (see the root README's "Desktop app" section); the project is not deployed to a web host.

## Architecture

The application follows a Model-View-Controller (MVC) architecture with Vue 3 Composition API:

### Composables (Business Logic)
- **useCircuitModel.js**: Circuit data management, tab system, and hierarchical circuit operations
- **useAppController.js**: Main application logic, file operations, and simulation orchestration
- **useCanvasController.js**: Canvas interaction handling, selection, and wire drawing
- **useComponentController.js**: Component creation, positioning, and component-related utilities
- **usePythonEngine.js**: Pyodide integration, Python execution, and MEMFS operations
- **useCodeGenController.js**: GGL code generation from visual circuits
- **useFileService.js**: File save/load operations with modern File System Access API
- **useCanvasViewport.js**: Canvas viewport management, zooming, and grid operations
- **useWireController.js**: Wire drawing, junction management, and wire cleanup
- **useSelectionController.js**: Component and wire selection management
- **useDragController.js**: Drag and drop operations for components and wires
- **useComponentView.js**: Shared component view logic for visual styling

### Components (Views)
- **App.vue**: Main application shell with toolbar and canvas
- **CircuitCanvas.vue**: Main canvas component integrating all circuit operations
- **Component Library**: InputNode, OutputNode, LogicGate, SplitterComponent, MergerComponent, SchematicComponent
- **UI Components**: Toolbar, Inspector, file dialogs

### Utilities (Helpers)
- **componentRegistry.js**: Component definitions, connections, and configurations
- **componentFactory.js**: Dynamic component creation utilities
- **constants.js**: Shared constants for styling, dimensions, and colors

## Circuit Simulation

The application generates GGL (Golden Gates Language) Python code from visual circuits and executes it using Pyodide:

1. **Code Generation**: Visual circuit components are converted to GGL Python code
2. **Hierarchical Support**: Saved components are written as Python modules to Pyodide's MEMFS
3. **Dependency Resolution**: Automatic import handling for component dependencies
4. **Real-time Updates**: Python execution callbacks update Vue components instantly

## Development Guidelines

### Code Organization
- Keep business logic in composables following single responsibility principle
- Use MVC separation: Models (data), Views (components), Controllers (business logic)
- Prefer composition over inheritance using Vue 3 Composition API
- Use TypeScript-style JSDoc comments for better IDE support

### Naming Conventions
- **Models**: `use*Model.js` - Data management and state
- **Controllers**: `use*Controller.js` - Business logic and user interactions  
- **Services**: `use*Service.js` - External integrations and utilities
- **Views**: `use*View.js` - Component-specific UI logic

### Testing
The application is designed to support both component testing and end-to-end testing:
- **Component Testing**: Vitest for unit and integration tests
- **E2E Testing**: Playwright for full workflow testing and student circuit autograding

## Contributing

1. Follow the MVC architecture patterns established in the codebase
2. Add comprehensive JSDoc comments for all public functions
3. Use the established naming conventions for files and functions
4. Test both visual functionality and circuit simulation accuracy
5. Update documentation for any new features or architectural changes

## Future Enhancements

- **Advanced Components**: Memory elements (flip-flops, registers, RAM)
- **Timing Analysis**: Clock-based simulation and timing diagrams
- **Circuit Verification**: Formal verification tools for circuit correctness
- **Educational Features**: Interactive tutorials and circuit examples
- **Performance Optimization**: WebGL rendering for large circuits
- **Collaboration**: Real-time collaborative circuit editing


## Electron Desktop App

Golden Gates can run as a native desktop application using Electron, with native OS file dialogs and direct filesystem access.

### Installing the Desktop App

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the app:
   ```bash
   npm run electron:build
   ```

3. Open the output folder in Finder:
   ```bash
   ```

4. Drag `Golden Gates.app` into your `/Applications` folder.

That's it — open it like any other Mac app.

### Running in Dev Mode

To launch without packaging (useful during development):
```bash
npm run electron:dev
```

### How It Works

Electron wraps the compiled Vue app in a Chromium window with a Node.js backend running alongside it. This enables:
- **Native menu bar**: A File menu (New Circuit, Open..., Save) appears in the OS menu bar with standard keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S). Save and Open are not in the command palette.
- **Project-based open**: File → Open... picks a directory (e.g. a cloned student repo). The app derives the top-level circuit name from the directory name by stripping the `-githubID` suffix — so `project05-jsmith/` loads `project05.ggc` as the top-level circuit.
- **Silent save**: Cmd+S writes the active circuit directly to the project directory as `<CircuitName>.ggc` with no dialog. If no project is open, a save-as dialog appears as fallback.
- **Direct filesystem access**: Circuit files are written directly to disk via Node's `fs` module
- **Custom file type**: Circuits are saved as `.ggc` (Golden Gates Circuit) files. On macOS and Windows, double-clicking a `.ggc` file opens its parent directory as the project automatically.

The browser version continues to work unchanged. `useFileService.js` detects whether `window.electronAPI` is available and uses native file I/O if so, falling back to the existing browser behavior otherwise.

### Files Added

- `main.cjs` — Electron main process: creates the app window and handles IPC requests for file save/open
- `preload.cjs` — Security bridge that exposes `electronAPI` to the Vue app without giving it full Node.js access
- `assets/icon.icns` — App icon for macOS