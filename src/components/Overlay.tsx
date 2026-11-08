// What was found, drawn over the photo: in the photo's own pixels, so the
// labels keep their size, and lines that stay 2 px however it is shown.
import type { Detection } from "@petiole/sdk";

import { COLOURS, labelPlace, labelSize, labelText } from "../lib/draw";

export function Overlay({ detections, width, height }: { detections: readonly Detection[]; width: number; height: number }) {
  const size = labelSize(width, height);
  return (
    <svg aria-hidden className="overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {detections.map((detection, index) => (
        <g key={index}>
          {detection.polygons?.map((polygon, part) => (
            <polygon
              key={part}
              points={polygon.map((point) => `${point.x * width},${point.y * height}`).join(" ")}
              fill={COLOURS.fill}
              stroke={COLOURS.stroke}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <rect
            x={detection.bbox.x * width}
            y={detection.bbox.y * height}
            width={detection.bbox.width * width}
            height={detection.bbox.height * height}
            fill="none"
            stroke={COLOURS.stroke}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {detections.map((detection, index) => {
        const text = labelText(detection);
        const place = labelPlace(detection.bbox.x * width, detection.bbox.y * height, size);
        return (
          <g key={`label-${index}`}>
            <rect x={place.x} y={place.y} width={text.length * size * 0.6 + size * 0.4} height={size * 1.4} fill={COLOURS.label} />
            <text x={place.x + size * 0.2} y={place.y + size * 1.05} fontSize={size} fontWeight={600} fill={COLOURS.labelText}>
              {text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
