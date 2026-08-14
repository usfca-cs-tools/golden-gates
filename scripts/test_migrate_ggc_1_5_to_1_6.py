"""Tests for the 1.5->1.6 migration. Run: python3 -m pytest golden-gates/scripts/ (or run directly).

These are pure-logic tests (no ggl import): they lock the geometric reorder, the numeric port
naming, and — the subtle part — that wire endpoints follow their inner LABEL to its new slot so a
non-tidy circuit keeps its connectivity after the order changes.
"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import migrate_ggc_1_5_to_1_6 as m


def test_reorder_interface_sorts_io_by_position_only():
    comps = [
        {"id": "a", "type": "input", "x": 0, "y": 4},
        {"id": "gate", "type": "and-gate", "x": 5, "y": 5},
        {"id": "b", "type": "input", "x": 0, "y": 0},
        {"id": "s", "type": "output", "x": 9, "y": 2},
    ]
    out = m.reorder_interface(comps)
    # inputs sorted top-to-bottom (b above a); the gate keeps its slot; output unchanged.
    assert [c["id"] for c in out] == ["b", "gate", "a", "s"]


def _write(dirpath, name, ggc):
    with open(os.path.join(dirpath, name), "w") as f:
        json.dump(ggc, f)


def test_multifile_reorders_child_and_moves_wires_to_follow_label():
    # child: inputs inserted A (y=4) then B (y=0) — insertion order != geometry (B is on top).
    child = {
        "version": "1.5",
        "name": "sub",
        "components": [
            {"id": "a", "type": "input", "x": 0, "y": 4, "props": {"label": "A"}},
            {"id": "b", "type": "input", "x": 0, "y": 0, "props": {"label": "B"}},
            {"id": "o", "type": "output", "x": 9, "y": 0, "props": {"label": "O"}},
        ],
        "wires": [],
    }
    # parent places the child at (10, 10). Under 1.5 (insertion) the ports are A@y1, B@y2. A wire
    # targets port "1" == label B, at absolute (10, 12).
    parent = {
        "version": "1.5",
        "name": "top",
        "components": [
            {
                "id": "p",
                "type": "schematic-component",
                "x": 10,
                "y": 10,
                "props": {"filename": "sub.ggc"},
                "ports": m._insertion_ports(child["components"]),
            }
        ],
        "wires": [
            {"endConnection": {"pos": {"x": 10, "y": 12}}, "points": [{"x": 10, "y": 12}]}
        ],
    }
    with tempfile.TemporaryDirectory() as d:
        _write(d, "sub.ggc", child)
        _write(d, "top.ggc", parent)
        m.migrate_dir(d, apply=True)
        sub_after = json.load(open(os.path.join(d, "sub.ggc")))
        top_after = json.load(open(os.path.join(d, "top.ggc")))

    assert sub_after["version"] == "1.6"
    # child interface reordered geometrically: B (y=0) now first.
    assert [c["id"] for c in sub_after["components"] if c["type"] == "input"] == ["b", "a"]
    # B is now geometric slot 1 (after O? no — inputs first): inputs [B, A] -> B@y1, A@y2. The wire
    # that meant "B" must move from y=12 (old B slot) to y=11 (new B slot) so it still hits B.
    end = top_after["wires"][0]["endConnection"]["pos"]
    assert (end["x"], end["y"]) == (10, 11)
    # ...and its drawn point moved with it.
    assert (top_after["wires"][0]["points"][0]["x"], top_after["wires"][0]["points"][0]["y"]) == (10, 11)


def test_self_contained_is_skipped_untouched():
    embedded = {
        "version": "1.5",
        "name": "top",
        "components": [
            {"id": "p", "type": "schematic-component", "x": 0, "y": 0, "props": {"circuitId": "c2"}}
        ],
        "wires": [],
        "schematicComponents": {
            "c2": {"circuit": {"components": [
                {"id": "a", "type": "input", "x": 0, "y": 4, "props": {"label": "A"}},
                {"id": "b", "type": "input", "x": 0, "y": 0, "props": {"label": "B"}},
            ]}}
        },
    }
    with tempfile.TemporaryDirectory() as d:
        _write(d, "top.ggc", embedded)
        m.migrate_dir(d, apply=True)
        after = json.load(open(os.path.join(d, "top.ggc")))
    # Untouched: still 1.5, embedded child order unchanged.
    assert after["version"] == "1.5"
    assert [c["id"] for c in after["schematicComponents"]["c2"]["circuit"]["components"]] == ["a", "b"]


if __name__ == "__main__":
    test_reorder_interface_sorts_io_by_position_only()
    test_multifile_reorders_child_and_moves_wires_to_follow_label()
    test_self_contained_is_skipped_untouched()
    print("ok")
