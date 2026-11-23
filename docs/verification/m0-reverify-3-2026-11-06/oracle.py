"""Check recorded API output from exact binary64 inputs and independent pi."""
import json
import sys
from decimal import Decimal as D, getcontext

getcontext().prec = 90
PI = D("3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628")
MAX = D(float.fromhex("0x1.fffffffffffffp1023"))
# Round-to-nearest overflow boundary is half the top finite spacing above MAX.
OVERFLOW = MAX + D(2) ** 970
REL_SLOPE_TOL = D("1e-14")
ABS_DELTA_TOL = D("1e-15")
slope_errors = []
delta_errors = []
failures = []
results = []


def close(actual, expected, errors, tolerance, relative=False):
    error = abs(D(actual) - expected)
    if relative:
        error /= abs(expected) if expected else 1
    errors.append(error)
    assert error <= tolerance, (actual, str(expected), str(error))


def numbers(sweep):
    points = {p["alphaDeg"]: p for p in sweep["series"]}
    assert set(points) == {0, 4}
    assert sweep["validity"]["status"] in ("ok", "warning")
    assert all(p["validity"]["status"] in ("ok", "warning") for p in points.values())
    difference = D(points[4]["cl"]) - D(points[0]["cl"])
    return difference * 45 / PI, D(points[4]["cdi"])


def expected(a, b):
    slopes = [a[0], b[0]]
    per_grid = [abs(x) < OVERFLOW for x in slopes]
    reasons = [f"{name} two-point lift slope is nonfinite"
               for name, good in zip(("coarse", "fine"), per_grid) if not good]
    dc = dd = None
    if all(per_grid):
        dc = abs(b[0] - a[0]) / max(abs(a[0]), D(1e-300))
        dd = abs(b[1] - a[1]) / max(abs(a[1]), D(1e-300))
        if max(dc, dd) >= OVERFLOW:
            reasons = ["comparison metrics are nonfinite"]
    return per_grid, reasons, dc, dd


def grid_status(actual, name, good):
    assert actual == {"valid": good, "reasons": [] if good else
                      [f"{name} two-point lift slope is nonfinite"]}, actual


def metrics(actual, reasons, dc, dd, omitted=False):
    for key, value in (("deltaClAlpha", dc), ("deltaCdi", dd)):
        if reasons:
            assert key not in actual if omitted else actual[key] is None
        else:
            close(actual[key], value, delta_errors, ABS_DELTA_TOL)


def brief(pair):
    return [{"slope": format(s, ".20E"),
             "old_degree_product_overflows": abs(s * PI) >= OVERFLOW}
            for s, _ in pair]


for line in open(sys.argv[1], encoding="utf-8"):
    row = json.loads(line)
    ident = row["id"]
    if ident == "seed":
        continue
    if ident != "solver":
        pair = [numbers(row[k]) for k in ("coarse", "fine")]
        flags, reasons, dc, dd = expected(*pair)
        check = row["comparison"]
        results.append({"id": ident, "grids": brief(pair), "expected_flags": flags,
                        "expected_reasons": reasons, "expected_delta": str(dc), "actual": check})
        try:
            for name, good in zip(("coarse", "fine"), flags):
                grid_status(check[name], name, good)
            assert check["valid"] == (not reasons) and check["reasons"] == reasons
            metrics(check, reasons, dc, dd)
        except AssertionError:
            failures.append(ident)
        continue

    pairs = [numbers(sweep) for sweep in row["sweeps"]]
    results.append({"area": row["area"], "grids": brief(pairs),
                    "prescribed": row["checks"][0]["claim"],
                    "custom": row["checks"][1]["claim"]})
    flags, reasons, dc, dd = expected(*pairs[:2])
    for check in row["checks"]:
        assert check["gates"] == {"clAlpha": .01, "cdi": .05}
        assert check["coverage"]["alphaDeg"] == check["inputIdentity"]["alphaProtocolDeg"] == [0, 4]
        assert check["coverage"]["latticeCounts"] == check["inputIdentity"]["lattices"]["current"]["spanwisePanels"]
        assert check["coverage"]["betaDeg"] == check["inputIdentity"]["betaDeg"] == 0
        assert check["inputIdentity"]["seedReferencePlaceholder"] is False
        assert check["uncertaintyLabel"] == "unverified: fixed Tier-0 uncertainty claim unavailable"
        assert check["comparisonValidity"] == {"valid": not reasons, "reasons": reasons}
        metrics(check, reasons, dc, dd)
        prescribed_gates = not reasons and dc <= D(".01") and dd <= D(".05")
        assert check["withinGates"] == prescribed_gates
        for key, name, good, (slope, drag) in zip(("r1", "r2"), ("coarse", "fine"), flags, pairs):
            grid = check[key]
            grid_status(grid["validity"], name, good)
            if good:
                close(grid["clAlphaTwoPointPerRad"], slope, slope_errors, REL_SLOPE_TOL, relative=True)
                assert D(grid["cdiAt4Deg"]) == drag
            else:
                assert grid["clAlphaTwoPointPerRad"] is None and grid["cdiAt4Deg"] is None
        if check["currentGrid"] is None:
            applicable = reasons
            claim = "withheld" if applicable else "prescribed R1 vs R2"
            gates = prescribed_gates
        else:
            custom = check["currentGrid"]
            custom_flags, applicable, cdc, cdd = expected(*pairs[2:])
            validity = custom["validity"]
            assert validity["valid"] == (not applicable) and validity["reasons"] == applicable
            for key, name, good in zip(("current", "refined"), ("coarse", "fine"), custom_flags):
                grid_status(validity[key], name, good)
            metrics(custom, applicable, cdc, cdd, omitted=True)
            assert custom["claim"] == ("withheld" if applicable else "compared")
            gates = not applicable and cdc <= D(".01") and cdd <= D(".05")
            if not applicable:
                assert custom["withinGates"] == gates and custom["gates"] == check["gates"]
            claim = "withheld" if applicable else "current lattice vs 2x refined lattice"
        assert check["claim"] == claim
        assert check["badge"] == ("green" if gates else "amber")
        assert check["coverage"]["coversPlottedLattice"] == (not applicable)
        assert check["withholdingReason"] == ("; ".join(applicable) if applicable else None)

print(json.dumps({"max_slope_relative_error": str(max(slope_errors)),
                  "max_delta_absolute_error": str(max(delta_errors)),
                  "slope_relative_tolerance": str(REL_SLOPE_TOL),
                  "delta_absolute_tolerance": str(ABS_DELTA_TOL),
                  "failures": failures, "results": results}, indent=2))
sys.exit(bool(failures))
