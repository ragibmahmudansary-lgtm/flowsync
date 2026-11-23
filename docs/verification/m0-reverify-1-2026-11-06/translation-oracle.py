"""Independent dimensional VLM check. This file only uses NumPy and stated inputs."""
import json
import math

import numpy as np

# span, root chord, tip chord, quarter-chord sweep, dihedral, incidence, x, z
surfaces = [(10, 3, 1.75, 12, 6, -3, 0, 0), (6, 2, 1.2, -8, 3, 2, 384, 256)]
reference = np.array([128., 0.2, 128.])
rho, velocity, area, chord, length = 1.17, 31, 28, 2.2, 100
q_area = .5 * rho * velocity**2 * area


def section(s, y, fraction):
    b, c0, c1, sweep, dihedral, incidence, x, z = s
    chord = c0 + (c1 - c0) * (2 * abs(y) / b)
    angles = [math.radians(a) for a in (sweep, dihedral, incidence)]
    q = np.array([x + c0 / 4 + abs(y) * math.tan(angles[0]),
                  y, z + abs(y) * math.tan(angles[1])])
    d = np.array([math.cos(angles[2]), 0, -math.sin(angles[2])])
    return q + (fraction - .25) * chord * d, d


def segment(p, a, b):
    r_a, r_b = p - a, p - b
    cross = np.cross(r_a, r_b)
    norm_squared = cross @ cross
    # Same-side bound filaments are collinear outside the segment. Remove
    # roundoff in their cross product before the analytic zero is divided.
    if norm_squared <= (1e-13 * np.linalg.norm(r_a) * np.linalg.norm(r_b)) ** 2:
        return np.zeros(3)
    factor = (b - a) @ (r_a / np.linalg.norm(r_a) - r_b / np.linalg.norm(r_b))
    return factor * cross / (4 * np.pi * norm_squared)


def solve(alpha, beta):
    a, b = map(math.radians, (alpha, beta))
    wake = np.array([math.cos(a)*math.cos(b), -math.sin(b), math.sin(a)*math.cos(b)])
    lift_axis = np.array([-math.sin(a), 0, math.cos(a)])
    panels = []
    for surface in surfaces:
        edges = np.linspace(-surface[0] / 2, surface[0] / 2, 5)
        for y0, y1 in zip(edges[:-1], edges[1:]):
            for row in range(2):
                start, direction = section(surface, y0, (row + .25) / 2)
                end, _ = section(surface, y1, (row + .25) / 2)
                control, _ = section(surface, (y0 + y1) / 2, (row + .75) / 2)
                normal = np.cross(direction, end - start)
                panels.append((start, end, control, normal / np.linalg.norm(normal)))

    def horseshoe(p, panel, include_bound):
        start, end = panel[:2]
        w = length * wake
        legs = segment(p, end, end + w) + segment(p, start + w, start)
        return legs + segment(p, start, end) if include_bound else legs

    matrix = [[normal @ horseshoe(control, source, True) for source in panels]
              for _, _, control, normal in panels]
    gamma = np.linalg.solve(matrix, [-velocity * (normal @ wake) for _, _, _, normal in panels])
    forces, moments = [], []
    trefftz = 0.
    project = np.eye(3) - np.outer(wake, wake)
    for i, (start, end, _, _) in enumerate(panels):
        middle = (start + end) / 2
        induced = sum(g * horseshoe(middle, panel, i != j)
                      for j, (g, panel) in enumerate(zip(gamma, panels)))
        force = rho * gamma[i] * np.cross(velocity * wake + induced, end - start)
        forces.append(force)
        moments.append(np.cross(middle - reference, force))
        transverse_velocity = np.zeros(3)
        for g, (leg_a, leg_b, _, _) in zip(gamma, panels):
            for sign, endpoint in [(-1, leg_a), (1, leg_b)]:
                delta = project @ (middle - endpoint)
                transverse_velocity += sign * g * np.cross(wake, delta) / (2 * np.pi * (delta @ delta))
        trefftz += .5 * rho * gamma[i] * (np.cross(transverse_velocity, end - start) @ wake)

    force, moment = np.sum(forces, axis=0), np.sum(moments, axis=0)
    return dict(alpha=alpha, beta=beta, gamma=gamma.tolist(), force=force.tolist(),
                moment=moment.tolist(), rawNear=force @ wake, rawTrefftz=trefftz,
                cl=(force @ lift_axis) / q_area, cm=moment[1] / (q_area * chord),
                cdi=trefftz / q_area, cdiNearField=(force @ wake) / q_area, wake=length)


print(json.dumps([solve(a, b) for a, b in [(0, 0), (1, 0), (2, 0), (3, -7), (4, -7), (5, -7)]],
                 indent=2, allow_nan=False))
