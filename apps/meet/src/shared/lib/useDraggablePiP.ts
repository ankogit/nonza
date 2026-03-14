import { ref, onMounted, onUnmounted } from "vue";

const PIP_MIN_WIDTH = 160;
const PIP_MIN_HEIGHT = 160;
const PIP_MAX_WIDTH = 400;
const PIP_MAX_HEIGHT = 400;
const PIP_DEFAULT_WIDTH = 128;
const PIP_DEFAULT_HEIGHT = 128;
const PADDING = 16;

function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  bottomOffset: number,
) {
  const maxX = Math.max(PADDING, window.innerWidth - width - PADDING);
  const maxY = Math.max(
    PADDING,
    window.innerHeight - height - bottomOffset - PADDING,
  );
  return {
    x: Math.max(PADDING, Math.min(x, maxX)),
    y: Math.max(PADDING, Math.min(y, maxY)),
  };
}

const docOpt = { capture: true };

export function useDraggablePiP(
  _initialPos = { x: PADDING, y: PADDING },
  initialSize = { width: PIP_DEFAULT_WIDTH, height: PIP_DEFAULT_HEIGHT },
  options?: { getBottomOffset?: () => number },
) {
  const getBottomOffset = options?.getBottomOffset ?? (() => 88);

  const size = ref({
    width: Math.min(PIP_MAX_WIDTH, Math.max(PIP_MIN_WIDTH, initialSize.width)),
    height: Math.min(
      PIP_MAX_HEIGHT,
      Math.max(PIP_MIN_HEIGHT, initialSize.height),
    ),
  });
  const position = ref(
    clampPosition(
      window.innerWidth - size.value.width - PADDING,
      window.innerHeight - size.value.height - getBottomOffset() - PADDING,
      size.value.width,
      size.value.height,
      getBottomOffset(),
    ),
  );

  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let captureTarget: HTMLElement | null = null;
  let pointerId: number | null = null;

  function onPointerMove(e: PointerEvent) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const next = clampPosition(
      startLeft + dx,
      startTop + dy,
      size.value.width,
      size.value.height,
      getBottomOffset(),
    );
    position.value = next;
  }

  function onPointerUp() {
    document.removeEventListener("pointermove", onPointerMove as any, docOpt);
    document.removeEventListener("pointerup", onPointerUp, docOpt);
    if (captureTarget && pointerId != null) {
      try {
        captureTarget.releasePointerCapture(pointerId);
      } catch {}
    }
    captureTarget = null;
  }

  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest("[data-pip-resize-handle]")) return;
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = position.value.x;
    startTop = position.value.y;
    pointerId = e.pointerId;
    captureTarget = e.currentTarget as HTMLElement;
    captureTarget.setPointerCapture(e.pointerId);
    document.addEventListener("pointermove", onPointerMove as any, docOpt);
    document.addEventListener("pointerup", onPointerUp, docOpt);
  }

  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;

  function onResizePointerMove(e: PointerEvent) {
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    let w = Math.max(
      PIP_MIN_WIDTH,
      Math.min(PIP_MAX_WIDTH, resizeStartWidth + dx),
    );
    let h = Math.max(
      PIP_MIN_HEIGHT,
      Math.min(PIP_MAX_HEIGHT, resizeStartHeight + dy),
    );
    const side = Math.max(w, h);
    w = Math.max(PIP_MIN_WIDTH, Math.min(PIP_MAX_WIDTH, side));
    h = w;
    size.value = { width: w, height: h };
    position.value = clampPosition(
      position.value.x,
      position.value.y,
      size.value.width,
      size.value.height,
      getBottomOffset(),
    );
  }

  function onResizePointerUp() {
    document.removeEventListener(
      "pointermove",
      onResizePointerMove as any,
      docOpt,
    );
    document.removeEventListener("pointerup", onResizePointerUp, docOpt);
    if (captureTarget && pointerId != null) {
      try {
        captureTarget.releasePointerCapture(pointerId);
      } catch {}
    }
    captureTarget = null;
    position.value = clampPosition(
      position.value.x,
      position.value.y,
      size.value.width,
      size.value.height,
      getBottomOffset(),
    );
  }

  function handleResizePointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartWidth = size.value.width;
    resizeStartHeight = size.value.height;
    pointerId = e.pointerId;
    captureTarget = e.currentTarget as HTMLElement;
    captureTarget.setPointerCapture(e.pointerId);
    document.addEventListener(
      "pointermove",
      onResizePointerMove as any,
      docOpt,
    );
    document.addEventListener("pointerup", onResizePointerUp, docOpt);
  }

  function onWindowResize() {
    position.value = clampPosition(
      position.value.x,
      position.value.y,
      size.value.width,
      size.value.height,
      getBottomOffset(),
    );
  }

  onMounted(() => {
    window.addEventListener("resize", onWindowResize);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", onWindowResize);
    document.removeEventListener("pointermove", onPointerMove as any, docOpt);
    document.removeEventListener("pointerup", onPointerUp, docOpt);
    document.removeEventListener(
      "pointermove",
      onResizePointerMove as any,
      docOpt,
    );
    document.removeEventListener("pointerup", onResizePointerUp, docOpt);
  });

  return { position, size, handlePointerDown, handleResizePointerDown };
}
