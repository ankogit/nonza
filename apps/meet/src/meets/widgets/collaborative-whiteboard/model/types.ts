export type WhiteboardAwarenessPayload = {
  phase: "hover" | "drawing";
  nx: number;
  ny: number;
  // Normalized brush width: lineWidthPx / minDimPx.
  // Receiver can convert it back to pixels via `width * minDimPx`.
  width?: number;
  // Whether the sender is currently using the eraser tool.
  erase?: boolean;
  // Brush color (any valid CSS color).
  color?: string;
};

export type WhiteboardStrokeSnapshot = {
  id: string;
  pts: [number, number][];
  color: string;
  width: number;
};
