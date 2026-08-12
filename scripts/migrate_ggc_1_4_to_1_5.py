#!/usr/bin/env python3
"""Migrate Golden Gates .ggc files from format 1.4 to 1.5.

WHY: multi-file project saves before the getConnections fix stamped every
schematic-component placement with the collapsed 1-in/1-out *default* ports (the
save resolved the subcircuit by filename, but computeComponentPorts only looked
at circuitId). ggl.view matches wires to ports by coordinate, so those files fail
to grade/simulate. Format 1.5 marks "ports are trustworthy"; the app now refuses
to open 1.4, so this is the one-way migration.

WHAT: for each .ggc in a directory, recompute each schematic-component's ports
from the subcircuit it references and stamp version "1.5". Leaf-component ports
were always correct and are left untouched. Files are rewritten with the app's
exact serialization (JSON.stringify(x, null, 2) + trailing newline), so a git
diff shows only the version line and the expanded port arrays.

Run it on a MULTI-FILE PROJECT DIRECTORY (a folder of .ggc that reference each
other by filename). It also upgrades self-contained files (subcircuits embedded
under schematicComponents, referenced by circuitId). Do NOT run it on a project
authored at a different PORT_PITCH than this script's — the recomputed ports
would no longer line up with the saved wires.

IMPORTANT: the port geometry below MUST match web/src/utils/componentRegistry.js
(the schematic-component getConnections) and web/src/utils/constants.js
(PORT_PITCH). It is duplicated here only so the migration can run headless; if
that geometry changes, update this too.

Usage:  migrate_ggc_1_4_to_1_5.py DIR...            # dry run: report what would change
        migrate_ggc_1_4_to_1_5.py --apply DIR...    # rewrite the files in place
"""
import glob
import json
import math
import os
import sys

PORT_PITCH = 1  # must match web/src/utils/constants.js


def _jround(x):
    """JavaScript Math.round (round half up) — Python's round() is banker's rounding."""
    return math.floor(x + 0.5)


def schematic_ports(sub_components):
    """Ports for a schematic-component placement, matching componentRegistry.getConnections +
    portGeometry.computeComponentPorts: inputs then outputs, in the subcircuit's file order,
    each named by its index."""
    ins = [c for c in sub_components if c.get("type") == "input"]
    outs = [c for c in sub_components if c.get("type") == "output"]
    max_ports = max(len(ins), len(outs), 1)
    height = max(4, (max_ports - 1) * PORT_PITCH + 2)
    width = 6

    def place(items, is_input):
        direction = "input" if is_input else "output"
        if not items:
            return [{"name": "0", "x": (0 if is_input else width),
                     "y": _jround(height / 2), "direction": direction}]
        ports = []
        for i, it in enumerate(items):
            rot = (it.get("props", {}) or {}).get("rotation", 0) or 0
            y = _jround(height / 2 if len(items) == 1 else 1 + i * PORT_PITCH)
            if is_input:
                cp = {"x": 0, "y": y}
                cp = ({"x": width / 2, "y": 0} if rot == 90 else
                      {"x": width, "y": y} if rot == 180 else
                      {"x": width / 2, "y": height} if rot == 270 else cp)
            else:
                cp = {"x": width, "y": y}
                cp = ({"x": width / 2, "y": height} if rot == 90 else
                      {"x": 0, "y": y} if rot == 180 else
                      {"x": width / 2, "y": 0} if rot == 270 else cp)
            ports.append({"name": str(i), "x": cp["x"], "y": cp["y"], "direction": direction})
        return ports

    return place(ins, True) + place(outs, False)


def _resolve_subcircuit(comp, ggc, by_name):
    """The referenced subcircuit's components — by filename (multi-file) or embedded circuitId."""
    props = comp.get("props", {}) or {}
    filename = props.get("filename")
    if filename and filename in by_name:
        return by_name[filename].get("components", [])
    cid = props.get("circuitId")
    if cid:
        sub = (ggc.get("schematicComponents", {}) or {}).get(cid)
        if sub:
            return (sub.get("circuit", {}) or {}).get("components", [])
    return None


def migrate_dir(directory, apply):
    paths = sorted(glob.glob(os.path.join(directory, "*.ggc")))
    by_name = {}
    for path in paths:
        try:
            by_name[os.path.basename(path)] = json.load(open(path))
        except (OSError, json.JSONDecodeError) as err:
            print(f"  ! skip {os.path.basename(path)}: {err}")
    for path in paths:
        name = os.path.basename(path)
        ggc = by_name.get(name)
        if ggc is None:
            continue
        old_version = ggc.get("version")
        fixed = []
        for comp in ggc.get("components", []) or []:
            if comp.get("type") != "schematic-component":
                continue
            sub = _resolve_subcircuit(comp, ggc, by_name)
            if sub is None:
                print(f"  ? {name}: cannot resolve subcircuit for {comp.get('id')} — left as-is")
                continue
            new_ports = schematic_ports(sub)
            if comp.get("ports") != new_ports:
                fixed.append((comp.get("props", {}) or {}).get("label") or comp.get("id"))
                if apply:
                    comp["ports"] = new_ports
        needs_version = old_version != "1.5"
        if not (fixed or needs_version):
            continue
        parts = []
        if needs_version:
            parts.append(f"version {old_version}->1.5")
        if fixed:
            parts.append(f"{len(fixed)} ports: {', '.join(fixed)}")
        print(f"  {'WROTE' if apply else 'would change'}: {name}  [{'; '.join(parts)}]")
        if apply:
            ggc["version"] = "1.5"
            with open(path, "w") as f:
                f.write(json.dumps(ggc, indent=2, ensure_ascii=False) + "\n")


def main(argv):
    apply = "--apply" in argv
    dirs = [a for a in argv if a != "--apply"]
    if not dirs:
        print(__doc__)
        return 1
    for directory in dirs:
        print(f"=== {directory} ({'APPLY' if apply else 'dry run'}) ===")
        migrate_dir(directory, apply)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
