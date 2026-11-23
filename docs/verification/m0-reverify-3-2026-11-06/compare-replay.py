"""Compare new scratch outputs with the retained M0-REVERIFY-2 replay."""
from pathlib import Path
import gzip
import json

phase = Path(__file__).resolve().parent
current = phase / "replay"
prior = phase.parent / "m0-reverify-2-2026-11-06" / "replay"


def ndjson(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


sol = ndjson(current / "sol.out")
prior_sol = ndjson(prior / "sol.out")
edges = json.loads((current / "edges.out").read_text())
prior_edges = json.loads((prior / "edges.out").read_text())
measure = json.loads(gzip.decompress((current / "measurements.json.gz").read_bytes()))
prior_measure = json.loads(gzip.decompress((prior / "measurements.json.gz").read_bytes()))
report = {
    "exit": {p.stem: int(p.read_text()) for p in sorted(current.glob("*.exit"))},
    "sol": {"rows": len(sol), "prior_rows": len(prior_sol),
            "changed_rows": [i for i, (a, b) in enumerate(zip(sol, prior_sol), 1) if a != b]},
    "edge_changed_groups": sorted(k for k in edges.keys() | prior_edges.keys()
                                  if edges.get(k) != prior_edges.get(k)),
    "measurement_changed_groups": sorted(k for k in measure.keys() | prior_measure.keys()
                                         if measure.get(k) != prior_measure.get(k)),
    "stdout_byte_equal": {p.stem: p.read_bytes() == (prior / p.name).read_bytes()
                          for p in sorted(current.glob("*.out"))},
}
print(json.dumps(report, indent=2))
