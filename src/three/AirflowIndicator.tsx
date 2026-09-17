import { useMemo } from "react";
import * as THREE from "three";
import { useAeroStore } from "@/state/useAeroStore";
import { freestreamDirection } from "@/modules/solver/vlmSolver";

/**
 * Airflow indicator showing freestream direction with arrows.
 */
export function AirflowIndicator() {
  const alpha = useAeroStore((s) => s.displayAlphaDeg);

  const geometry = useMemo(() => {
    const dir = freestreamDirection(alpha);
    const positions: number[] = [];
    const colors: number[] = [];

    // Draw 3 arrows showing flow direction
    const offsets: [number, number, number][] = [
      [-3, -2, 0],
      [-3, 0, 0],
      [-3, 2, 0],
    ];

    const arrowLength = 2;
    const headLength = 0.3;

    for (const offset of offsets) {
      const start = offset;
      const end = [
        offset[0] + dir[0] * arrowLength,
        offset[1] + dir[1] * arrowLength,
        offset[2] + dir[2] * arrowLength,
      ];

      // Shaft
      positions.push(start[0], start[1], start[2]);
      positions.push(end[0], end[1], end[2]);
      colors.push(0.2, 0.6, 0.8, 0.2, 0.6, 0.8);

      // Arrow head (two lines)
      const perp1 = [dir[1], -dir[0], 0];
      const perp2 = [-dir[1], dir[0], 0];

      const head1 = [
        end[0] - dir[0] * headLength + perp1[0] * headLength * 0.5,
        end[1] - dir[1] * headLength + perp1[1] * headLength * 0.5,
        end[2] - dir[2] * headLength + perp1[2] * headLength * 0.5,
      ];
      const head2 = [
        end[0] - dir[0] * headLength + perp2[0] * headLength * 0.5,
        end[1] - dir[1] * headLength + perp2[1] * headLength * 0.5,
        end[2] - dir[2] * headLength + perp2[2] * headLength * 0.5,
      ];

      positions.push(end[0], end[1], end[2], head1[0], head1[1], head1[2]);
      colors.push(0.2, 0.6, 0.8, 0.2, 0.6, 0.8);
      positions.push(end[0], end[1], end[2], head2[0], head2[1], head2[2]);
      colors.push(0.2, 0.6, 0.8, 0.2, 0.6, 0.8);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [alpha]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors linewidth={2} />
    </lineSegments>
  );
}
