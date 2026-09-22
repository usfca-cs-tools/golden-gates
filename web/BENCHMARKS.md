# GGL effective clock frequency

How fast the GGL engine can actually advance a circuit — the ceiling on Run and Run
Tests. This is distinct from the **UI clock frequency** you set on a circuit (e.g. 1 Hz):
that only paces the free-running `Run`, whereas tests and the settle engine run at best
effort. The number below is the *effective* clock: full cycles per second the engine
sustains (one cycle = a rising + falling edge; a register latches on the rising edge).

Two runtimes:
- **native** — CPython running the engine headless (what `grade.py` / pytest use).
- **Pyodide** — the same engine inside the WASM runtime the Golden Gates web app loads
  (pyodide 0.27.6). This is closer to what a student experiences in the browser.

The circuits are synthetic `counter-bank ×N` sweeps (N independent `reg <- reg + 1`
counters on one clock), built in `ggl-engine/scripts/benchmark.py` — reproducible and
reviewable, no external files. Cost scales with node count; the settle passes per edge
stay flat because the counters share one combinational depth.

| Circuit | deep nodes | settle passes / edge | native ms/edge | native clock | Pyodide ms/edge | Pyodide clock | Pyodide tax |
|---|--:|--:|--:|--:|--:|--:|--:|
| counter-bank x1 | 6 | 2.5 | 0.018 | 27.8k Hz | 0.033 | 15.2k Hz | 1.8× |
| counter-bank x4 | 12 | 2.5 | 0.054 | 9.2k Hz | 0.093 | 5.4k Hz | 1.7× |
| counter-bank x16 | 36 | 2.5 | 0.215 | 2.3k Hz | 0.329 | 1.5k Hz | 1.5× |
| counter-bank x64 | 132 | 2.5 | 0.797 | 628 Hz | 1.304 | 384 Hz | 1.6× |
| counter-bank x256 | 516 | 2.5 | 3.191 | 157 Hz | 5.169 | 97 Hz | 1.6× |

_Numbers are machine-dependent (measured on one host); regenerate to compare. Regenerate with:_
```
node scripts/benchmark-pyodide.mjs
```
