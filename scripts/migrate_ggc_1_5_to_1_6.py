#!/usr/bin/env python3
"""Migrate Golden Gates .ggc files from format 1.5 to 1.6.

WHY: 1.6 numbers a subcircuit's ports by the GEOMETRIC (top-to-bottom, then left-to-right)
position of its inner input/output components, instead of the order they were inserted. This
makes a placed subcircuit's port order match what the student sees, so designs can be rearranged
cleanly. The engine resolves a placement's positional port name by the inner component ARRAY
order, so a 1.6 file must store its interface components in geometric order.

The app opens 1.5 files untouched (it keeps their insertion order), so this migration is OPT-IN —
run it only when you want a project's ports re-sorted geometrically. For a project whose inputs are
already laid out top-to-bottom (most tidy circuits), it is a near no-op: it reorders nothing and
only stamps the version.

WHAT, per .ggc in a directory:
  1. Reorder each circuit's input components into geometric order among themselves, and its output
     components likewise (other components keep their slots). This is what the engine reads.
  2. For every schematic-component placement, MOVE any wire endpoint sitting on one of its ports to
     wherever that same inner label now sits, so no wire detaches when the order changes.
  3. Recompute the placement's serialized `ports` array in the new order.
  4. Stamp version "1.6".

Files are rewritten with the app's exact serialization (JSON.stringify(x, null, 2) + trailing
newline), so a git diff shows only what actually moved.

LIMITATION: only multi-file PROJECTS (a directory of .ggc that reference each other by filename)
are migrated. A self-contained export — one that embeds its subcircuits under schematicComponents —
is skipped and left at its current version; it still opens as 1.5. Re-save it as a project first if
you want 1.6 ordering.

IMPORTANT: the port geometry below MUST match web/src/utils/componentRegistry.js (getConnections)
and web/src/utils/constants.js (PORT_PITCH). It is duplicated here only so the migration can run
headless; if that geometry changes, update this too.

Usage:  migrate_ggc_1_5_to_1_6.py DIR...            # dry run: report what would change
        migrate_ggc_1_5_to_1_6.py --apply DIR...    # rewrite the files in place
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


def _by_position(components):
    """Geometric order: top-to-bottom, then left-to-right. Matches componentRegistry.byPosition."""
    return sorted(components, key=lambda c: (c.get("y", 0) or 0, c.get("x", 0) or 0))


def reorder_interface(components):
    """Return a new component list with input components in geometric order among their slots, and
    outputs likewise — every other component untouched. Mirrors
    componentRegistry.reorderInterfaceComponents."""
    ins = iter(_by_position([c for c in components if c.get("type") == "input"]))
    outs = iter(_by_position([c for c in components if c.get("type") == "output"]))
    result = []
    for c in components:
        if c.get("type") == "input":
            result.append(next(ins))
        elif c.get("type") == "output":
            result.append(next(outs))
        else:
            result.append(c)
    return result


def schematic_ports(sub_components):
    """Ports for a schematic-component placement referencing a subcircuit with these components,
    in the SAME order and geometry as componentRegistry.getConnections at 1.6 (geometric order,
    index names). Returns a list of {name, x, y, direction}."""
    ins = _by_position([c for c in sub_components if c.get("type") == "input"])
    outs = _by_position([c for c in sub_components if c.get("type") == "output"])
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


def _port_moves(comp, old_sub, new_sub):
    """Absolute-coordinate remap for one placement: old port position -> new port position for the
    SAME inner label, when the geometric reorder moved it. `old_sub` is the subcircuit's component
    list as it was on disk (insertion order); `new_sub` is after reorder_interface. Returns
    {(x, y): (x, y)} keyed by rounded absolute coordinate."""
    cx, cy = comp.get("x", 0), comp.get("y", 0)
    # Old geometry used insertion order → number ports by that order; new uses geometric order.
    old_ports = _insertion_ports(old_sub)
    new_ports = schematic_ports(new_sub)
    old_by_label = _ports_by_label(old_ports, old_sub, insertion=True)
    new_by_label = _ports_by_label(new_ports, new_sub, insertion=False)
    moves = {}
    for label, direction in old_by_label:
        op = old_by_label[(label, direction)]
        np = new_by_label.get((label, direction))
        if np is None:
            continue
        old_abs = (round(cx + op["x"], 3), round(cy + op["y"], 3))
        new_abs = (round(cx + np["x"], 3), round(cy + np["y"], 3))
        if old_abs != new_abs:
            moves[old_abs] = new_abs
    return moves


def _insertion_ports(sub_components):
    """The 1.5 port layout: same geometry as schematic_ports but INSERTION order (no sort)."""
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


def _ports_by_label(ports, sub_components, insertion):
    """Pair each port with the inner component's label. `ports` is in insertion or geometric order;
    the matching component order must be the same."""
    ins = [c for c in sub_components if c.get("type") == "input"]
    outs = [c for c in sub_components if c.get("type") == "output"]
    if not insertion:
        ins, outs = _by_position(ins), _by_position(outs)
    ordered = ins + outs
    result = {}
    for port, comp in zip(ports, ordered):
        label = (comp.get("props", {}) or {}).get("label", "")
        result[(label, port["direction"])] = port
    return result


def _remap_wire_endpoints(wires, moves):
    """Move any wire endpoint sitting on an old port position to the new one. Returns the number of
    endpoints moved."""
    moved = 0
    for wire in wires or []:
        for key in ("startConnection", "endConnection"):
            conn = wire.get(key)
            pos = conn.get("pos") if conn else None
            if not pos:
                continue
            k = (round(pos.get("x", 0), 3), round(pos.get("y", 0), 3))
            if k in moves:
                pos["x"], pos["y"] = moves[k]
                moved += 1
        # A wire's drawn points include its endpoints; nudge any that coincide with a moved port.
        for point in wire.get("points", []) or []:
            k = (round(point.get("x", 0), 3), round(point.get("y", 0), 3))
            if k in moves:
                point["x"], point["y"] = moves[k]
                moved += 1
    return moved


def migrate_dir(directory, apply):
    paths = sorted(glob.glob(os.path.join(directory, "*.ggc")))
    if not paths:
        # Say so loudly — an empty run almost always means a wrong path (e.g. the directory name
        # passed while already inside it), NOT "nothing to migrate".
        hint = "" if os.path.isdir(directory) else "  (directory does not exist)"
        print(f"  no .ggc files found in {directory}{hint}")
        return
    by_name = {}
    for path in paths:
        try:
            by_name[os.path.basename(path)] = json.load(open(path))
        except (OSError, json.JSONDecodeError) as err:
            print(f"  ! skip {os.path.basename(path)}: {err}")
    # A subcircuit's ORIGINAL (insertion) order is the "old" side of every wire remap. We mutate
    # by_name in place, so resolve referenced children against a pristine snapshot — otherwise a
    # child processed earlier (files run alphabetically) would already be reordered and the remap
    # would compute zero moves, silently repointing wires at the wrong inner label.
    pristine = json.loads(json.dumps(by_name))
    for path in paths:
        name = os.path.basename(path)
        ggc = by_name.get(name)
        if ggc is None:
            continue

        # Self-contained exports embed their subcircuits under schematicComponents (referenced by
        # circuitId) instead of as sibling files. Reordering those correctly means recursively
        # reordering every embedded (and nested) subdef and remapping their internal wires — enough
        # surface that a mistake would silently mis-wire a working circuit. They already open fine as
        # 1.5, so skip them here; re-save them as a multi-file PROJECT if you want 1.6 ordering.
        if ggc.get("schematicComponents"):
            print(f"  skip (self-contained export, left at {ggc.get('version')}): {name}")
            continue

        old_version = ggc.get("version")
        notes = []

        # 1 + 2: remap wires for each placement, using the child's ORIGINAL (insertion) order —
        # taken from the pristine snapshot — as the "old" side.
        wires_moved = 0
        for comp in ggc.get("components", []) or []:
            if comp.get("type") != "schematic-component":
                continue
            sub = _resolve_subcircuit(comp, pristine.get(name, ggc), pristine)
            if sub is None:
                notes.append(f"unresolved subcircuit for {comp.get('id')}")
                continue
            new_sub = reorder_interface(sub)
            moves = _port_moves(comp, sub, new_sub)
            wires_moved += _remap_wire_endpoints(ggc.get("wires"), moves)
            if apply:
                comp["ports"] = schematic_ports(new_sub)

        # 3: reorder this circuit's own interface components (what the engine reads for its labels).
        reordered = reorder_interface(ggc.get("components", []) or [])
        interface_changed = [c.get("id") for c in reordered] != [
            c.get("id") for c in (ggc.get("components", []) or [])
        ]
        if apply and interface_changed:
            ggc["components"] = reordered

        if interface_changed:
            notes.append("interface reordered")
        if wires_moved:
            notes.append(f"{wires_moved} wire endpoint(s) moved")

        needs_version = old_version != "1.6"
        if not (needs_version or interface_changed or wires_moved or notes):
            continue
        parts = []
        if needs_version:
            parts.append(f"version {old_version}->1.6")
        parts.extend(notes)
        print(f"  {'WROTE' if apply else 'would change'}: {name}  [{'; '.join(parts)}]")
        if apply:
            ggc["version"] = "1.6"
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
