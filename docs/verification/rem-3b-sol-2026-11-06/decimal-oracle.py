"""Exact rational progression and Python's correctly-rounded binary64 conversion."""
from fractions import Fraction
import json

VECTORS = [
    ["decimal endpoint", "0", "0.3", "0.1"],
    ["below decimal endpoint", "0", "0.29999999999999993", "0.1"],
    ["above decimal endpoint", "0", "0.30000000000000004", "0.1"],
    ["reversed with sign change", "0.3", "-0.1", "0.1"],
    ["cap just below", "0", "20.099999999999998", "0.1"],
    ["cap exact", "0", "20.1", "0.1"],
    ["cap just above", "0", "20.100000000000005", "0.1"],
    ["final binary64 spacing change", "9007199254740990", "9007199254740992", "1"],
    ["no further step is in range", "9007199254740990", "9007199254740996", "2.1"],
    ["halfway rounds up to even", "9007199254740992", "9007199254741000", "3"],
    ["rounded duplicates", "9007199254740992", "9007199254740996", "1.1"],
    ["subnormal rounding", "-1e-323", "1e-323", "5e-324"],
    ["count with binary64 subtraction overflow", "-1e308", "1e308", "1"],
    ["historical single-point progress refusal", "1e17", "1e17", "1"],
]
output = []
for name, start, end, step in VECTORS:
    lo, hi = sorted([Fraction(start), Fraction(end)])
    increment = Fraction(step)
    count = (hi - lo) // increment + 1
    expected = "resource limit"
    if count <= 201:
        expected = [float(lo + i * increment) for i in range(count)]
        if any(a >= b for a, b in zip(expected, expected[1:])):
            expected = "distinct advancing"
        elif lo == hi and float(lo) + float(increment) == float(lo):
            expected = "cannot advance"
    output.append(dict(name=name, inputs=[start, end, step], expected=expected))
print(json.dumps(output, separators=(",", ":"), allow_nan=False))
