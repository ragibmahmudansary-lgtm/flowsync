#!/usr/bin/env python3
"""Independent planform-geometry oracle for a binary STL wing.

Usage: python3 -I oracle.py <stl_path> <rule> <out_json>
Rules: all | drone-wing | drone-with-winglets
Mapped frame (m): L = raw_x*1e-3, Y = raw_z*1e-3, V = raw_y*1e-3.
"""
import sys, json, time, hashlib, math
import numpy as np

K = 400
SCALE = 0.001


# ----------------------------------------------------------------- IO
def read_stl(path):
    dt = np.dtype([("f", "<f4", (12,)), ("a", "<u2")])
    with open(path, "rb") as fh:
        head = fh.read(84)
        n = int(np.frombuffer(head[80:84], dtype="<u4")[0])
        rest = fh.read()
    if 84 + 50 * n != 84 + len(rest):
        raise ValueError("size mismatch: header says %d tris, payload %d bytes" % (n, len(rest)))
    arr = np.frombuffer(rest, dtype=dt, count=n)
    v = arr["f"][:, 3:12].astype(np.float64).reshape(n, 3, 3)  # raw mm, (x,y,z)
    return v


def select(raw, rule):
    cz = (raw[:, 0, 2] + raw[:, 1, 2] + raw[:, 2, 2]) / 3.0
    a = np.abs(cz)
    if rule == "all":
        m = np.ones(len(raw), bool)
    elif rule == "drone-wing":
        m = (a >= 300.0) & (a < 990.0)
    elif rule == "drone-with-winglets":
        m = a >= 300.0
    else:
        raise ValueError("unknown rule " + rule)
    return np.flatnonzero(m)


def to_mapped(raw):
    """raw (n,3,3) xyz mm -> mapped (n,3,3) columns (L,Y,V) metres."""
    out = np.empty_like(raw)
    out[..., 0] = raw[..., 0] * SCALE
    out[..., 1] = raw[..., 2] * SCALE
    out[..., 2] = raw[..., 1] * SCALE
    return out


# ------------------------------------------------------------ slicing
def slice_stations(tri, Ys, chunk=1_500_000):
    """tri: (n,3,3) mapped (L,Y,V). Returns per-station Lmin,Lmax,Vmin,Vmax (inf/-inf if empty)."""
    nS = len(Ys)
    Lmin = np.full(nS, np.inf); Lmax = np.full(nS, -np.inf)
    Vmin = np.full(nS, np.inf); Vmax = np.full(nS, -np.inf)
    ty = tri[:, :, 1]
    j0 = np.searchsorted(Ys, ty.min(axis=1), side="left")
    j1 = np.searchsorted(Ys, ty.max(axis=1), side="right")
    cnt = (j1 - j0).astype(np.int64)
    keep = np.flatnonzero(cnt > 0)
    if keep.size == 0:
        return Lmin, Lmax, Vmin, Vmax
    cum = np.cumsum(cnt[keep])
    total = int(cum[-1])
    start = 0
    while start < keep.size:
        base = cum[start - 1] if start > 0 else 0
        end = int(np.searchsorted(cum, base + chunk, side="right"))
        if end <= start:
            end = start + 1
        idx = keep[start:end]
        c = cnt[idx]
        tid = np.repeat(idx, c)
        offs = np.arange(int(c.sum())) - np.repeat(np.cumsum(c) - c, c)
        sid = np.repeat(j0[idx], c) + offs
        P = tri[tid]                     # (m,3,3)
        y = Ys[sid]
        d = P[:, :, 1] - y[:, None]      # (m,3)
        Lc = []; Vc = []; Mc = []
        for i in range(3):
            Lc.append(P[:, i, 0]); Vc.append(P[:, i, 2]); Mc.append(d[:, i] == 0.0)
        for i, j in ((0, 1), (1, 2), (2, 0)):
            di, dj = d[:, i], d[:, j]
            cross = (di < 0) & (dj > 0) | (di > 0) & (dj < 0)
            den = np.where(cross, di - dj, 1.0)
            t = di / den
            Lc.append(P[:, i, 0] + t * (P[:, j, 0] - P[:, i, 0]))
            Vc.append(P[:, i, 2] + t * (P[:, j, 2] - P[:, i, 2]))
            Mc.append(cross)
        Lc = np.stack(Lc, 1); Vc = np.stack(Vc, 1); Mc = np.stack(Mc, 1)
        lmin = np.where(Mc, Lc, np.inf).min(1); lmax = np.where(Mc, Lc, -np.inf).max(1)
        vmin = np.where(Mc, Vc, np.inf).min(1); vmax = np.where(Mc, Vc, -np.inf).max(1)
        order = np.argsort(sid, kind="stable")
        s_sorted = sid[order]
        ustart = np.flatnonzero(np.r_[True, s_sorted[1:] != s_sorted[:-1]])
        us = s_sorted[ustart]
        Lmin[us] = np.minimum(Lmin[us], np.minimum.reduceat(lmin[order], ustart))
        Lmax[us] = np.maximum(Lmax[us], np.maximum.reduceat(lmax[order], ustart))
        Vmin[us] = np.minimum(Vmin[us], np.minimum.reduceat(vmin[order], ustart))
        Vmax[us] = np.maximum(Vmax[us], np.maximum.reduceat(vmax[order], ustart))
        start = end
    return Lmin, Lmax, Vmin, Vmax


def projection_area(tri):
    """0.5 * sum(|n_V| * A), tri in mapped frame (V = column 2)."""
    e1 = tri[:, 1] - tri[:, 0]
    e2 = tri[:, 2] - tri[:, 0]
    cr = np.cross(e1, e2)
    two_a = np.linalg.norm(cr, axis=1)
    A = 0.5 * two_a
    nv = np.where(two_a > 0, np.abs(cr[:, 2]) / np.where(two_a > 0, two_a, 1.0), 0.0)
    return 0.5 * float(np.sum(nv * A))


def boundary_edges(raw_sel, tol_mm=1e-4):
    n = len(raw_sel)
    if n == 0:
        return 0, 0
    q = np.rint(raw_sel.reshape(-1, 3) / tol_mm).astype(np.int64)
    order = np.lexsort((q[:, 2], q[:, 1], q[:, 0]))
    qs = q[order]
    new = np.r_[True, np.any(qs[1:] != qs[:-1], axis=1)]
    ids_sorted = np.cumsum(new) - 1
    ids = np.empty(len(q), np.int64)
    ids[order] = ids_sorted
    ids = ids.reshape(n, 3)
    a = np.concatenate([ids[:, 0], ids[:, 1], ids[:, 2]])
    b = np.concatenate([ids[:, 1], ids[:, 2], ids[:, 0]])
    ok = a != b
    a, b = a[ok], b[ok]
    lo = np.minimum(a, b); hi = np.maximum(a, b)
    key = lo * (int(ids.max()) + 1) + hi
    _, counts = np.unique(key, return_counts=True)
    return int(np.sum(counts == 1)), int(np.sum(counts > 2))


# ------------------------------------------------------------ analysis
def analyse(tri, raw_sel=None):
    """tri mapped (n,3,3). Returns dict of results (without file metadata)."""
    Y = tri[:, :, 1]
    Ymin, Ymax = float(Y.min()), float(Y.max())
    dY = (Ymax - Ymin) / K
    Ys = Ymin + (np.arange(K) + 0.5) * dY
    Lmin, Lmax, Vmin, Vmax = slice_stations(tri, Ys)
    pop = np.isfinite(Lmin)
    chord = np.where(pop, Lmax - Lmin, np.nan)
    xle = np.where(pop, Lmin, np.nan)
    xc4 = xle + 0.25 * chord
    vmid = np.where(pop, 0.5 * (np.where(pop, Vmin, 0) + np.where(pop, Vmax, 0)), np.nan)

    pidx = np.flatnonzero(pop)
    out = {}
    out["K"] = K
    out["lateralRange"] = [Ymin, Ymax]
    out["bounds"] = {
        "L": [float(tri[:, :, 0].min()), float(tri[:, :, 0].max())],
        "Y": [Ymin, Ymax],
        "V": [float(tri[:, :, 2].min()), float(tri[:, :, 2].max())],
    }
    out["extents"] = {k: v[1] - v[0] for k, v in out["bounds"].items()}
    out["populatedStationCount"] = int(pidx.size)
    if pidx.size == 0:
        raise RuntimeError("no populated stations")
    out["areaPopulatedM2"] = float(np.sum(chord[pidx]) * dY)
    first, last = pidx[0], pidx[-1]
    bridged = np.zeros(K)
    bridged[pidx] = chord[pidx]
    inner = np.arange(first, last + 1)
    unp_in = inner[~pop[inner]]
    if unp_in.size:
        bridged[unp_in] = np.interp(Ys[unp_in], Ys[pidx], chord[pidx])
    out["bridgedStationCount"] = int(unp_in.size)
    out["unpopulatedOutsideCount"] = int(K - (last - first + 1))
    areaB = float(np.sum(bridged) * dY)
    out["areaBridgedM2"] = areaB
    out["macBridgedM"] = float(np.sum(bridged ** 2) * dY / areaB) if areaB > 0 else None
    span = Ymax - Ymin
    out["spanM"] = span
    out["aspectRatio"] = span ** 2 / areaB if areaB > 0 else None

    straddle = Ymin < 0.0 < Ymax
    Yroot = 0.0 if straddle else Ymin
    out["Yroot"] = Yroot
    d_root = np.abs(Ys[pidx] - Yroot)
    root3 = pidx[np.argsort(d_root, kind="stable")[:3]]
    out["rootChordM"] = float(np.mean(chord[root3]))
    if straddle:
        tipset = np.concatenate([pidx[:2], pidx[-2:]])
    else:
        far_high = abs(Ymax - Yroot) >= abs(Ymin - Yroot)
        tipset = pidx[-2:] if far_high else pidx[:2]
    out["tipChordM"] = float(np.mean(chord[tipset]))
    out["taperRatio"] = out["tipChordM"] / out["rootChordM"] if out["rootChordM"] else None
    out["xLeRootM"] = float(np.mean(xle[root3]))

    sw = pidx[Ys[pidx] >= 0.0] if straddle else pidx
    xs = np.abs(Ys[sw] - Yroot)
    out["sweepStationCount"] = int(sw.size)

    def slope(vals):
        if sw.size < 2:
            return None
        return float(np.polyfit(xs, vals[sw], 1)[0])

    def deg(s):
        return None if s is None else math.degrees(math.atan(s))

    out["leSweepDeg"] = deg(slope(xle))
    out["c4SweepDeg"] = deg(slope(xc4))
    out["dihedralDeg"] = deg(slope(vmid))

    out["projectionAreaM2"] = projection_area(tri)
    if raw_sel is not None:
        be, nm = boundary_edges(raw_sel)
        out["boundaryEdges"] = be
        out["nonManifoldEdges"] = nm
        out["closedSelection"] = bool(be == 0 and nm == 0)
    nn = lambda a: [None if not np.isfinite(x) else float(x) for x in a]
    out["stations"] = {"Y": [float(x) for x in Ys], "chord": nn(chord), "xLe": nn(xle)}
    return out


# ----------------------------------------------------------- self-check
def self_check():
    c, s, t = 2.0, 10.0, 0.1
    # corners (L,Y,V)
    L0, L1, Y0, Y1, V0, V1 = 0.0, c, -s / 2, s / 2, -t / 2, t / 2
    P = np.array([[L, Y, V] for L in (L0, L1) for Y in (Y0, Y1) for V in (V0, V1)], float)
    def idx(l, y, v): return l * 4 + y * 2 + v
    quads = [
        (idx(0,0,0), idx(0,1,0), idx(0,1,1), idx(0,0,1)),
        (idx(1,0,0), idx(1,1,0), idx(1,1,1), idx(1,0,1)),
        (idx(0,0,0), idx(1,0,0), idx(1,0,1), idx(0,0,1)),
        (idx(0,1,0), idx(1,1,0), idx(1,1,1), idx(0,1,1)),
        (idx(0,0,0), idx(1,0,0), idx(1,1,0), idx(0,1,0)),
        (idx(0,0,1), idx(1,0,1), idx(1,1,1), idx(0,1,1)),
    ]
    tris = []
    for a, b, c_, d in quads:
        tris.append([P[a], P[b], P[c_]]); tris.append([P[a], P[c_], P[d]])
    tri = np.array(tris)
    r = analyse(tri)
    assert abs(r["areaBridgedM2"] - 20.0) < 1e-9, r["areaBridgedM2"]
    assert abs(r["areaPopulatedM2"] - 20.0) < 1e-9
    assert abs(r["projectionAreaM2"] - 20.0) < 1e-9, r["projectionAreaM2"]
    raw = np.empty_like(tri)  # mapped -> raw mm, only to test closure logic
    raw[..., 0] = tri[..., 0] / SCALE; raw[..., 2] = tri[..., 1] / SCALE; raw[..., 1] = tri[..., 2] / SCALE
    be, nm = boundary_edges(raw)
    assert be == 0 and nm == 0
    print("self-check ok: box wing area = %.12f" % r["areaBridgedM2"])


# ---------------------------------------------------------------- main
def main():
    if len(sys.argv) != 4:
        print(__doc__); sys.exit(2)
    stl, rule, outp = sys.argv[1:]
    t0 = time.time()
    self_check()
    raw = read_stl(stl)
    sel = select(raw, rule)
    raw_sel = raw[sel]
    h = hashlib.sha256(sel.astype("<u4").tobytes()).hexdigest()
    tri = to_mapped(raw_sel)
    res = analyse(tri, raw_sel)
    result = {"fixture": stl, "rule": rule, "totalTriangles": int(len(raw)),
              "triangleCount": int(sel.size), "regionIndexSha256": h}
    result.update(res)
    result["wallSeconds"] = time.time() - t0
    result["numpy"] = np.__version__
    with open(outp, "w") as fh:
        json.dump(result, fh)
    keys = ["triangleCount", "lateralRange", "areaPopulatedM2", "areaBridgedM2", "bridgedStationCount",
            "unpopulatedOutsideCount", "macBridgedM", "spanM", "aspectRatio", "rootChordM", "tipChordM",
            "taperRatio", "leSweepDeg", "c4SweepDeg", "dihedralDeg", "xLeRootM", "projectionAreaM2",
            "closedSelection", "boundaryEdges", "wallSeconds"]
    for k in keys:
        print(k, result.get(k))


if __name__ == "__main__":
    main()
