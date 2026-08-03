# Golden Gates

[![Frontend Tests](https://github.com/usfca-cs-tools/golden-gates/actions/workflows/test-frontend.yml/badge.svg)](https://github.com/usfca-cs-tools/golden-gates/actions/workflows/test-frontend.yml)

![1bit-full-adder](./fa-1bit.png)

## Background

### What is it?

Golden Gates is a schematic circuit design tool intended to support CS 315 - Computer Architecture, at the University of San Francisco.

### Do we need another circuit simulator? 

1. We understand that many HDL projects exist, though most (Verilog, etc.) are more EE/CE-oriented than we intend. 
1. We intend to provide a modern, accessible tool to demystify the chain from compiler to microarchitecture, for an audience of Computer Science students. (that is, we don't calculate propagation delay)

### Long-term vision

We would like to include support for a (RISC-V) C compiler and machine code to the system, visually illustrating the path from C source code to microarchitecture.

### Non-goals

We would like to keep the door open to sythesizing student designs onto an FPGA. However, our current class projects are too complex to synthesize onto a reasonably-priced FPGA. 

## Usage

### The User Interface

1. Golden Gates has a minimalist user interface, where commands are grouped in the Command Palette, somewhat similar to VS Code or Spotlight.
1. To access the command palette, click on the Golden Gates icon at the upper left, or simply type "G" as a shortcut.
1. You can use autocomplete to type a few characters of the name of the command, or circuit component you want to insert. For example, type "xor" to insert an XOR gate.
1. You can use the clipboard to cut, copy, paste, and duplicate selected circuit components, using the standard keyboard shortcuts on your computer. Duplicate is Cmd-D on MacOS and Ctrl-D on Windows.
1. You can edit the properties of a circuit component using the property inspector on the right side of the app. For example, if you want an AND gate with four inputs, you can select an AND gate, and then modify its properties.
1. New subcircuits will appear as tabs in the the toolbar. For example, you can create subcircuits for an SR-Latch, save that as a Component, and then create a D-latch, where you can insert SR-Latches as subcircuits.
1. You can scroll/pan the circuit viewport using two-finger drag (if you have a trackpad) or scroll-wheel drag (if you have a mouse).

### Creating a Circuit

1. Start with Input and Output components to design your circuit
1. You can use any combination of logic gates, I/O, plexers, wires, memory, or arithmetic components to develop your circuit. We assume the specifications of your circuits are covered in a classroom similar to USF's Computer Architecture course.
1. Circuit components must be connected with wires between the output port(s) of one component and the input port(s) of other components.
1. You can create a junction (a wire whose source is another wire) by using the Option (on MacOS) or Alt (on Windows) key. Hold down that key and click on a wire to form a junction and start drawing the new wire.

### Running a Simulation

1. To run a simulation on a circuit you have drawn, choose Run from the command palette, or simply type "R" when the circuit area has keyboard focus.
1. Your output components will glow blue to indicate they have a value

### Working with Files

Since Golden Gates is a web app, it doesn't have direct access to the files on your computer's disk. However, you can upload and download files, with some variation by browser.

1. When you work with a circuit, your changes are stored in your browser's localStorage. This is safe and convenient to use, but you can't submit your browser's localStorage to GitHub for a grade.
1. To save a file to your computer's disk, use the Save command in the command palette, or simply type "S" when the circuit area has keyboard focus.
    1. On Chromium-based browsers (Chrome, Edge, Brave, Arc), this opens a File Save picker where you can choose the folder and filename for your project.
    1. On Safari and Firefox, saving your circuit makes a copy in the Downloads folder on your laptop. You'll have to move that file into your GitHub repo to get a grade.
1. To open a saved circuit, you can drag/drop the JSON file into the circuit area. Or you can use the Open command in the command palette. 
1. **Important** Golden Gates has no ability to save new updates to a previously-saved file. If you imagine the commands as "Save As" and "Save", Golden Gates has only "Save As".

### Working with Memory

Golden Gates contains a ROM component whose values can be loaded from a JSON file of this format:

    [
        0,
        255,
        "0xFF",
        "0b11111111",
        128,
        "0x80",
        "0b10000000",
        64,
        32,
        16,
        8,
        4,
        2,
        1,
        "0x00",
        "0b00000000"
    ]

## Development

If you want to develop for Golden Gates, the tool chain works like this:

### Front-End

1. The front-end is a [Vue.js](https://vuejs.org) app. You should be able to run it by
    1. Install node.js, and `npm install`
    1. run `npm run dev` to install the packages in the lockfile
    1. browse to localhost:3000 to run the single-page app
1. Changes to some JS/CSS components can be hot-reloaded using [vite](https://vite.dev). However, changes to GGL Python code require a page reload.
1. Unit test cases are developed using [vitest](https://vitest.dev), and can be run automatically during development using `npm run test`
1. Human-readable strings are managed using `i18n` and locale files. New translations are welcome.
1. At this time, the whole system runs in the browser, with no server (or "server-less") software


### GGL

1. The simulation engine, GGL (Golden Gates Language) is a subset of Python, where the implementation supports the logical (non-presentation) part of circuit simulation
1. GGL lives in its own repository ([usfca-cs-tools/ggl](https://github.com/usfca-cs-tools/ggl)) and is included here as a git submodule at `web/ggl-engine` so the engine can be shared with other repos. The Vue app serves it to Pyodide at `/ggl/` via `vite-plugin-static-copy` (see `web/vite.config.js`).
    1. After cloning, populate the submodule with `git submodule update --init`.
1. GGL was derived by feeding the spec for [Digital](https://github.com/hneemann/digital) through OpenAI O3 to get a [Python spec](https://github.com/phpeterson-usf/golden-gates/blob/main/gglang/design/ggl-design-o3-deep-research-v2.md)
1. Our GGL implementation can be unit-tested using our [autograder](https://github.com/phpeterson-usf/autograder) tool.
    ```text
    cd golden-gates/web/ggl-engine
    grade test
    ```
    1. Autograder searches up the directory tree for [config.toml](https://github.com/usfca-cs-tools/ggl/blob/main/config.toml), and uses that to find the [test case files](https://github.com/usfca-cs-tools/ggl/blob/main/tests/ggl/ggl.toml). 
1. The execution environment for browser-side Python is [pyodide](https://pyodide.org/en/stable/), which is why we have no server-side software to deploy (or pay for).

### Desktop app

The Electron desktop app is built by the
[`Build Desktop App`](.github/workflows/build-desktop.yml) workflow in two channels:

- **Rolling `latest` (development).** Every push to `main` (and manual *Run
  workflow*) rebuilds and republishes the
  [`latest`](https://github.com/usfca-cs-tools/golden-gates/releases/tag/latest)
  **prerelease** — always the newest build, at a stable URL. These are unvetted;
  the app's About box labels them a development build.
- **Tagged releases (stable).** Pushing a semver tag cuts a permanent, named
  release with its own entry on the Releases page. Cut one whenever a build is
  known good:

  ```sh
  git tag v2026.8.2        # or a milestone like v1.0.0 — must be valid semver
  git push origin v2026.8.2
  ```

Artifacts:

- **macOS** (Apple Silicon): `GoldenGates-<version>-macos-arm64.dmg` / `.zip`
- **Windows** (x64): `GoldenGates-<version>-windows-x64.exe` (installer)

where `<version>` is the tag for a tagged release (e.g. `2026.8.2`) or
`0.0.0-dev.<run>` for a rolling build. Each build also embeds the workflow run
number as a build number (Windows file version / macOS `CFBundleVersion`).

**Which build is this?** *Golden Gates → About Golden Gates* (macOS) or *Help →
About Golden Gates* (Windows) shows the build identifier and states plainly
whether it's a tagged release or a rolling development build.

These builds are **ad-hoc signed but not notarized**, so the OS blocks them on
first launch (after that, they open normally):

- **macOS**: open the `.dmg` and drag the app to Applications, then launch it.
  When macOS blocks it, go to **System Settings → Privacy & Security**, scroll
  to the bottom, and click **Open Anyway** (older macOS: right-click the app →
  **Open**). Alternatively, in Terminal:
  `xattr -dr com.apple.quarantine "/Applications/Golden Gates.app"`.
- **Windows**: on the SmartScreen prompt, click **More info → Run anyway**.

#### Code signing

To remove the first-launch warnings entirely, the builds need real signing
(both require paid certificates):

- **Windows** signing is already wired into the workflow. Add two repository
  secrets and the build signs the `.exe` automatically — no code change:
  - `WIN_CSC_LINK` — the base64-encoded `.pfx` certificate
    (`base64 -i cert.pfx | pbcopy`)
  - `WIN_CSC_KEY_PASSWORD` — the certificate password

  Without these secrets the Windows build is unsigned and SmartScreen shows an
  "Unknown publisher" warning. Note: publicly-trusted OV/EV certificates can no
  longer be exported as a `.pfx` file (the key must live on hardware), so this
  file-based path suits an existing/enterprise cert; for a new public cert use a
  cloud signing service (e.g. Azure Trusted Signing), which would need a
  different workflow step.
- **macOS** builds are currently ad-hoc signed (they run, but aren't
  notarized). Eliminating the macOS prompt needs Developer ID signing + Apple
  notarization (Apple Developer Program), wired in as additional secrets.

To build locally:

```bash
cd web
npm run build            # vite build (needs the ggl-engine submodule)
npm run icon             # generate the Windows icon from assets/icon.svg
npx electron-builder --mac   # or --win
```

### Distribution

Golden Gates ships as the Electron desktop app described above — end users
download the nightly builds, and collaborators run the app locally with
`npm run` (see [`web/README.md`](web/README.md)). There is no hosted web
deployment.
