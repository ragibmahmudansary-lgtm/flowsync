"""Independent arithmetic on represented coefficients captured by probe.mjs."""
import gzip
import json
import sys
from fractions import Fraction
from pathlib import Path

PI = Fraction("3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679")
RADIAN_INTERVAL = PI / 45
FLOOR = Fraction(1e-300)  # exact value of the represented binary64 constant
OVERFLOW = Fraction(2**1024 - 2**970)  # binary64 round-to-nearest overflow midpoint
GATES = {"clAlpha": 0.01, "cdi": 0.05}
LABEL = "unverified: fixed Tier-0 uncertainty claim unavailable"
REL_TOL = Fraction("1e-14")
ABS_TOL = Fraction("1e-15")
errors = {"slopeRelative": Fraction(0), "deltaAbsoluteBelowTen": Fraction(0), "deltaRelativeAboveTen": Fraction(0)}


def finite(value):
    return abs(value) < OVERFLOW


def check_number(actual, expected, slope=False):
    actual = Fraction(actual)
    error = abs(actual - expected)
    if slope:
        category, error, tolerance = "slopeRelative", error / abs(expected) if expected else error, REL_TOL
    elif abs(expected) > 10:
        category, error, tolerance = "deltaRelativeAboveTen", error / abs(expected), REL_TOL
    else:
        category, tolerance = "deltaAbsoluteBelowTen", ABS_TOL
    errors[category] = max(errors[category], error)
    assert error <= tolerance, (category, float(error), float(tolerance))


def grid(sweep, role):
    points = {point["alphaDeg"]: point for point in sweep["series"]}
    assert points.keys() == {0, 4} and len(sweep["series"]) == 2
    assert all(point["validity"]["status"] in ("ok", "warning") for point in points.values())
    assert sweep["validity"]["status"] in ("ok", "warning")
    slope = (Fraction(points[4]["cl"]) - Fraction(points[0]["cl"])) / RADIAN_INTERVAL
    drag = Fraction(points[4]["cdi"])
    valid = finite(slope)
    reasons = [] if valid else [f"{role} two-point lift slope is nonfinite"]
    return slope, drag, {"valid": valid, "reasons": reasons}


def expected(coarse, fine):
    a, drag_a, status_a = grid(coarse, "coarse")
    b, drag_b, status_b = grid(fine, "fine")
    denominator = max(abs(a), FLOOR)
    difference = b - a
    lift_delta = abs(difference) / denominator
    drag_delta = abs(drag_b - drag_a) / max(abs(drag_a), FLOOR)
    reasons = status_a["reasons"] + status_b["reasons"]
    if not reasons and not (finite(lift_delta) and finite(drag_delta)):
        reasons = ["comparison metrics are nonfinite"]
    return a, b, drag_a, drag_b, status_a, status_b, reasons, lift_delta, drag_delta, difference, denominator


def compare_metrics(observed, reasons, lift_delta, drag_delta, absent=False):
    if reasons:
        for field in ("deltaClAlpha", "deltaCdi"):
            if absent:
                assert field not in observed
            else:
                assert observed[field] is None
        return
    check_number(observed["deltaClAlpha"], lift_delta)
    check_number(observed["deltaCdi"], drag_delta)


def constructed(row):
    a, b, _, _, status_a, status_b, reasons, lift_delta, drag_delta, difference, denominator = expected(
        row["coarse"], row["fine"])
    actual = row["observed"]
    assert actual["coarse"] == status_a and actual["fine"] == status_b
    assert actual["valid"] == (not reasons) and actual["reasons"] == reasons
    compare_metrics(actual, reasons, lift_delta, drag_delta)
    return {
        "id": row["id"], "expectedSlopes": [float(s) if finite(s) else None for s in (a, b)],
        "differenceOverflows": not finite(difference), "usesCoarseFloor": denominator == FLOOR,
        "expectedLiftDelta": float(lift_delta) if not reasons else None,
        "observedLiftDelta": actual["deltaClAlpha"], "observedDragDelta": actual["deltaCdi"],
        "coarse": status_a, "fine": status_b, "reasons": reasons
    }


def flow(row):
    grids = row["grids"]
    a, b, drag_a, drag_b, status_a, status_b, reasons, lift_delta, drag_delta, _, _ = expected(*grids[:2])
    _, _, _, _, current, refined, custom_reasons, custom_lift, custom_drag, _, _ = expected(*grids[2:])
    within = not reasons and lift_delta <= Fraction(".01") and drag_delta <= Fraction(".05")
    custom_within = not custom_reasons and custom_lift <= Fraction(".01") and custom_drag <= Fraction(".05")
    result = []
    for check, custom in zip(row["comparisons"], (False, True), strict=True):
        assert check["gates"] == GATES
        assert check["uncertaintyLabel"] == LABEL
        assert check["inputIdentity"]["alphaProtocolDeg"] == check["coverage"]["alphaDeg"] == [0, 4]
        assert check["inputIdentity"]["betaDeg"] == check["coverage"]["betaDeg"] == row["betaDeg"]
        assert check["inputIdentity"]["seedReferencePlaceholder"] is False
        grid_label = "custom" if custom else "R1"
        assert check["coverage"]["latticeLabel"] == grid_label
        assert check["coverage"]["latticeCounts"] == grids[2 if custom else 0]["resolution"]["spanwisePanels"]
        assert check["comparisonValidity"] == {"valid": not reasons, "reasons": reasons}
        assert check["withinGates"] == within
        for key, status, slope, drag in [("r1", status_a, a, drag_a), ("r2", status_b, b, drag_b)]:
            grid_summary = check[key]
            assert grid_summary["validity"] == status
            if status["valid"]:
                check_number(grid_summary["clAlphaTwoPointPerRad"], slope, slope=True)
                assert Fraction(grid_summary["cdiAt4Deg"]) == drag
            else:
                assert grid_summary["clAlphaTwoPointPerRad"] is None and grid_summary["cdiAt4Deg"] is None
        compare_metrics(check, reasons, lift_delta, drag_delta)
        applicable_reasons = custom_reasons if custom else reasons
        assert check["coverage"]["coversPlottedLattice"] == (not applicable_reasons)
        assert check["withholdingReason"] == ("; ".join(applicable_reasons) if applicable_reasons else None)
        assert check["badge"] == ("green" if (custom_within if custom else within) else "amber")
        if custom:
            assert check["claim"] == ("withheld" if custom_reasons else "current lattice vs 2x refined lattice")
            comparison = check["currentGrid"]
            assert comparison["claim"] == ("withheld" if custom_reasons else "compared")
            assert comparison["validity"] == {
                "valid": not custom_reasons, "reasons": custom_reasons, "current": current, "refined": refined
            }
            compare_metrics(comparison, custom_reasons, custom_lift, custom_drag, absent=True)
            if not custom_reasons:
                assert comparison["gates"] == GATES and comparison["withinGates"] == custom_within
        else:
            assert check["currentGrid"] is None
            assert check["claim"] == ("withheld" if reasons else "prescribed R1 vs R2")
        applicable = check["currentGrid"] if custom else check
        result.append({"grid": grid_label, "claim": check["claim"], "badge": check["badge"],
                       "coverage": check["coverage"]["coversPlottedLattice"],
                       "deltaClAlpha": applicable.get("deltaClAlpha"), "deltaCdi": applicable.get("deltaCdi")})
    return {"id": row["id"], "grids": result}


capture = Path(sys.argv[1])
contents = gzip.decompress(capture.read_bytes()) if capture.suffix == ".gz" else capture.read_bytes()
rows = [json.loads(line) for line in contents.splitlines()]
report = {
    "constructed": [constructed(row) for row in rows if row["kind"] == "constructed"],
    "flow": [flow(row) for row in rows if row["kind"] == "real-flow"],
    "maxErrors": {category: float(error) for category, error in errors.items()}
}
assert len(report["constructed"]) == 11 and len(report["flow"]) == 5
print(json.dumps(report, indent=2))
