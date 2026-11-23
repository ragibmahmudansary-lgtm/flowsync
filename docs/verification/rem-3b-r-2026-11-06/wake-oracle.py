"""Independent four-strip reconstruction and axial Biot-Savart integral.

Uses the input dimensions and a local quarter-chord pivot. No production
imports or reads. Variant geometries isolate shortening and chord rounding.
"""
import json
import math
import numpy as np

SPAN = 132.9
CHORD = 64
VELOCITY = 40
RHO = 1.225

def segment(point, start, end):
    axis = end - start
    length = np.linalg.norm(axis)
    unit = axis / length
    delta = point - start
    axial = np.dot(unit, delta)
    radial = delta - axial * unit
    radius2 = np.dot(radial, radial)
    if radius2 < 1e-28:  # These fixtures only reach this at exact collinearity.
        return np.zeros(3)
    other = axial - length
    integral = axial / math.sqrt(axial**2 + radius2) - other / math.sqrt(other**2 + radius2)
    return np.cross(unit, radial) * integral / (4 * math.pi * radius2)

def measure(alpha_deg, beta_deg, wake_length, quantized_chord=False):
    alpha, beta, incidence = map(math.radians, (alpha_deg, beta_deg, 2))
    stream = np.array([math.cos(alpha) * math.cos(beta), -math.sin(beta), math.sin(alpha) * math.cos(beta)])
    normal = np.array([math.sin(incidence), 0, math.cos(incidence)])
    bounds_x = 0 if quantized_chord else CHORD / 4
    control_x = 0 if quantized_chord else bounds_x + CHORD / 2 * math.cos(incidence)
    control_z = -CHORD / 2 * math.sin(incidence)
    strips = []
    for i in range(4):
        a_y = SPAN * (i - 2) / 4
        b_y = SPAN * (i - 1) / 4
        a, b = np.array([bounds_x, a_y, 0]), np.array([bounds_x, b_y, 0])
        mid = (a + b) / 2
        control = np.array([control_x, mid[1], control_z])
        strips.append((a, b, mid, control))

    def horseshoe(point, strip, include_bound):
        a, b, _, _ = strip
        legs = segment(point, a + wake_length * stream, a) + segment(point, b, b + wake_length * stream)
        return legs + (segment(point, a, b) if include_bound else np.zeros(3))

    matrix = [[np.dot(horseshoe(control, source, True), normal) for source in strips]
              for _, _, _, control in strips]
    gamma = np.linalg.solve(matrix, np.full(4, -VELOCITY * np.dot(stream, normal)))
    forces, moments, transverse_drag = [], [], []
    for i, (a, b, mid, _) in enumerate(strips):
        induced = sum(gamma[j] * horseshoe(mid, source, i != j) for j, source in enumerate(strips))
        force = RHO * gamma[i] * np.cross(VELOCITY * stream + induced, b - a)
        forces.append(force)
        moments.append(np.cross(mid, force))
        transverse = np.zeros(3)
        for j, (leg_a, leg_b, _, _) in enumerate(strips):
            for leg, sign in [(leg_a, -1), (leg_b, 1)]:
                delta = mid - leg
                radial = delta - np.dot(delta, stream) * stream
                transverse += sign * gamma[j] * np.cross(stream, radial) / (2 * math.pi * np.dot(radial, radial))
        transverse_drag.append(0.5 * RHO * gamma[i] * np.dot(transverse, np.cross(b - a, stream)))

    force = np.sum(forces, axis=0)
    moment = np.sum(moments, axis=0)
    qs = 0.5 * RHO * VELOCITY**2 * SPAN * CHORD
    return {
        'alphaDeg': alpha_deg, 'betaDeg': beta_deg, 'wakeM': wake_length,
        'cl': float(np.dot(force, [-math.sin(alpha), 0, math.cos(alpha)]) / qs),
        'cdi': float(sum(transverse_drag) / qs), 'cdiNearField': float(np.dot(force, stream) / qs),
        'cm': float(moment[1] / (qs * CHORD)), 'force': force.tolist(), 'gamma': gamma.tolist()
    }

print(json.dumps({
    'axial': measure(0, 0, 1329),
    'shortWakeOnly': measure(0, 0, 1280),
    'chordOnly': measure(0, 0, 1329, True),
    'chordAndWake': measure(0, 0, 1280, True),
    'oblique': measure(3, 8, 1329),
}, indent=2))
