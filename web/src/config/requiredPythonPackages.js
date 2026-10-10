/**
 * Arrays/Lists of the required files served by vite that need to 
 * be loaded into Pyodide's MEMFS (file system). Maintained by hand
 * but subject to change
 */

export const REQUIRED_PACKAGES = {
    ggl: [
    '__init__.py',
    'arithmetic.py',
    'callbacks.py',
    'circuit.py',
    'component.py',
    'edge.py',
    'errors.py',
    'io.py',
    'logic.py',
    'memory.py',
    'node.py',
    'plexers.py',
    'view.py',
    'wires.py',
    'ggl_logging.py'
    ],
    ggasm: [
    '__init__.py',
    'assembler.py',
    'encoder.py',
    'errors.py',
    'opcodes.py',
    'parser.py',
    '_rv64_parser.py'
    ]
}

export const PYTHON_DEPENDENCIES  = []
