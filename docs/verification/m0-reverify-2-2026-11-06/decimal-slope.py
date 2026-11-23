"""Independently assess the 0/4 diagnostic arithmetic from saved case outputs."""
from decimal import Decimal as D, getcontext
import json
from pathlib import Path
import sys

getcontext().prec = 85
pi = D("3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628")
interval = 4 * pi / 180
limit = D.from_float(sys.float_info.max)
slope_relative_tolerance = D("1e-14")
delta_absolute_tolerance = D("1e-15")
path = Path(__file__).parent

def load(stage):
    return [json.loads(line) for line in (path / f"solver-{stage}.jsonl").read_text().splitlines()]

def decimal(number):
    return D.from_float(float(number))

def relative(actual, expected):
    error = abs(decimal(actual) - expected) / abs(expected)
    assert error <= slope_relative_tolerance, (actual, expected, error)
    return str(error)

def absolute_delta(actual, expected):
    # Subtracting two nearby coefficients amplifies relative error in their
    # small difference. A fractional delta is on the scale of its operands'
    # relative rounding error, so assess it in absolute fractional units.
    error = abs(decimal(actual) - expected)
    assert error <= delta_absolute_tolerance, (actual, expected, error)
    return str(error)

entry, final = load("entry"), load("final")
assert entry[0] == final[0]  # seed test, including all numeric comparison data
summary = []
for old, new in zip(entry[1:], final[1:], strict=True):
    assert old["refAreaM2"] == new["refAreaM2"]
    assert old["samples"] == new["samples"]
    slopes, cdis = [], []
    for grid in new["samples"]:
        p0, p4 = grid["series"]
        slopes.append((decimal(p4["cl"]) - decimal(p0["cl"])) / interval)
        cdis.append(decimal(p4["cdi"]))
    usable = [abs(slope) <= limit for slope in slopes]
    prescribed, custom = new["checks"]
    assert prescribed["coverage"]["coversPlottedLattice"] == all(usable[:2])
    assert custom["coverage"]["coversPlottedLattice"] == all(usable[2:])
    assert prescribed["comparisonValidity"]["valid"] == all(usable[:2])
    assert custom["comparisonValidity"] == prescribed["comparisonValidity"]
    current = custom["currentGrid"]
    assert current["validity"]["valid"] == all(usable[2:])
    errors = {}
    for i, (grid, scope) in enumerate(zip((prescribed["r1"], prescribed["r2"], current["validity"]["current"],
                                          current["validity"]["refined"]), ("r1", "r2", "current", "refined"))):
        validity = grid.get("validity", grid)
        assert validity["valid"] == usable[i]
        if not usable[i]:
            assert "two-point lift slope is nonfinite" in " ".join(validity["reasons"])
            if i < 2:
                assert grid["clAlphaTwoPointPerRad"] is None
                assert grid["cdiAt4Deg"] is None
        elif i < 2:
            errors[scope] = relative(grid["clAlphaTwoPointPerRad"], slopes[i])
            assert decimal(grid["cdiAt4Deg"]) == cdis[i]
    for metric, indices, covered in [(prescribed, (0, 1), all(usable[:2])), (current, (2, 3), all(usable[2:]))]:
        if covered:
            coarse, fine = indices
            errors[str(indices)] = {
                "deltaClAlphaAbsolute": absolute_delta(metric["deltaClAlpha"], abs(slopes[fine] - slopes[coarse]) / abs(slopes[coarse])),
                "deltaCdiAbsolute": absolute_delta(metric["deltaCdi"], abs(cdis[fine] - cdis[coarse]) / abs(cdis[coarse]))
            }
        else:
            for field in ("deltaClAlpha", "deltaCdi"):
                if metric is prescribed:
                    assert metric[field] is None
                else:
                    assert field not in metric
    for check in new["checks"]:
        if not check["coverage"]["coversPlottedLattice"]:
            assert check["claim"] == "withheld"
            assert check["badge"] == "amber"
    summary.append({"areaM2": new["refAreaM2"], "decimalSlopes": [f"{value:.18E}" for value in slopes],
                    "representable": usable, "entryClaims": [c["claim"] for c in old["checks"]],
                    "finalClaims": [c["claim"] for c in new["checks"]], "errors": errors})

assert [row["representable"] for row in summary] == [
    [False, False, False, False], [False, True, False, False], [True, True, False, False],
    [True, True, True, True], [True, True, True, True]
]
print(json.dumps({"slopeRelativeTolerance": str(slope_relative_tolerance),
                  "deltaAbsoluteTolerance": str(delta_absolute_tolerance), "binary64Max": str(limit), "fixtures": summary}, indent=2))
