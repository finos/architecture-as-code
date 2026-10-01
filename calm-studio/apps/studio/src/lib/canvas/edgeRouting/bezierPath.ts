// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Convert orthogonal waypoint polylines into cubic Bezier segments (R50).
 */

export interface PathPoint {
	x: number;
	y: number;
}

export function parseSvgPathPoints(path: string): PathPoint[] {
	const points: PathPoint[] = [];
	const re = /[ML]\s*([-\d.]+)\s*,\s*([-\d.]+)/gi;
	let match: RegExpExecArray | null;
	while ((match = re.exec(path)) !== null) {
		points.push({ x: Number(match[1]), y: Number(match[2]) });
	}
	return points;
}

export function pointsToBezierPath(points: PathPoint[]): string {
	if (points.length === 0) return '';
	if (points.length === 1) return `M ${points[0]!.x},${points[0]!.y}`;
	if (points.length === 2) {
		const a = points[0]!;
		const b = points[1]!;
		const dx = (b.x - a.x) / 2;
		const dy = (b.y - a.y) / 2;
		return `M ${a.x},${a.y} C ${a.x + dx},${a.y + dy} ${b.x - dx},${b.y - dy} ${b.x},${b.y}`;
	}

	let d = `M ${points[0]!.x},${points[0]!.y}`;
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i]!;
		const b = points[i + 1]!;
		const mx = (a.x + b.x) / 2;
		const my = (a.y + b.y) / 2;
		d += ` Q ${a.x},${a.y} ${mx},${my}`;
		if (i === points.length - 2) {
			d += ` T ${b.x},${b.y}`;
		}
	}
	return d;
}

export function orthogonalPathToBezier(path: string): string {
	const points = parseSvgPathPoints(path);
	if (points.length < 2) return path;
	return pointsToBezierPath(points);
}
