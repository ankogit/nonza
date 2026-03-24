export type WhiteboardAwarenessPayload = {
  phase: "hover" | "drawing";
  nx: number;
  ny: number;
};

export type WhiteboardStrokeSnapshot = {
  id: string;
  pts: [number, number][];
  color: string;
  width: number;
};
