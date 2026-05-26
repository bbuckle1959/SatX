import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { ChevronUp } from 'lucide-react';

const PEEK_HEIGHT_PX = 76;
const EXPANDED_VH = 78;
const DRAG_EXPAND_THRESHOLD_PX = 48;

export interface BottomSheetMetrics {
  calcFps: number;
  renderFps: number;
  activeCount: number;
  servicingLabel: string | null;
}

interface MobileBottomSheetProps {
  metrics: BottomSheetMetrics;
  children: ReactNode;
}

export function MobileBottomSheet({ metrics, children }: MobileBottomSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragDeltaRef = useRef(0);
  const expandedAtDragStart = useRef(false);
  const pointerMoved = useRef(false);

  const collapse = useCallback(() => setExpanded(false), []);
  const expand = useCallback(() => setExpanded(true), []);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') collapse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, collapse]);

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    expandedAtDragStart.current = expanded;
    pointerMoved.current = false;
    setIsDragging(true);
    dragDeltaRef.current = 0;
    setDragDelta(0);
  };

  const onHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dy = e.clientY - dragStartY.current;
    if (Math.abs(dy) > 6) pointerMoved.current = true;
    dragDeltaRef.current = dy;
    setDragDelta(dy);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);

    const dy = dragDeltaRef.current;
    dragDeltaRef.current = 0;
    setDragDelta(0);

    if (dy < -DRAG_EXPAND_THRESHOLD_PX) {
      expand();
      return;
    }
    if (dy > DRAG_EXPAND_THRESHOLD_PX) {
      collapse();
      return;
    }
    setExpanded(expandedAtDragStart.current);
  };

  const dragOffsetPx = isDragging
    ? Math.max(-120, Math.min(120, dragDelta))
    : 0;

  const sheetHeight = expanded
    ? `min(${EXPANDED_VH}dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 0.5rem))`
    : `${PEEK_HEIGHT_PX}px`;

  return (
    <>
      <button
        type="button"
        className={`bottom-sheet-backdrop${expanded ? ' bottom-sheet-backdrop--visible' : ''}`}
        aria-label="Close panel"
        tabIndex={expanded ? 0 : -1}
        onClick={collapse}
      />
      <div
        className={`bottom-sheet${expanded ? ' bottom-sheet--expanded' : ''}${isDragging ? ' bottom-sheet--dragging' : ''}`}
        style={{
          height: sheetHeight,
          transform: dragOffsetPx ? `translateY(${dragOffsetPx}px)` : undefined,
        }}
        role="dialog"
        aria-modal={expanded}
        aria-expanded={expanded}
      >
        <div
          className="bottom-sheet-handle"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onClick={(e) => {
            if (!pointerMoved.current) toggle();
            e.stopPropagation();
          }}
        >
          <div className="bottom-sheet-grabber" aria-hidden />
          <div className="bottom-sheet-handle-metrics">
            <span className="sheet-metric">
              <span className="sheet-metric-label">Calc</span>
              <span className="sheet-metric-value">{metrics.calcFps}</span>
            </span>
            <span className="sheet-metric">
              <span className="sheet-metric-label">Render</span>
              <span className="sheet-metric-value">{metrics.renderFps}</span>
            </span>
            <span className="sheet-metric">
              <span className="sheet-metric-label">Active</span>
              <span className="sheet-metric-value">
                {metrics.activeCount.toLocaleString()}
              </span>
            </span>
            <span className="sheet-metric sheet-metric--servicing">
              <span className="sheet-metric-label">Servicing</span>
              <span
                className="sheet-metric-value sheet-metric-value--truncate"
                title={metrics.servicingLabel ?? undefined}
              >
                {metrics.servicingLabel ?? '—'}
              </span>
            </span>
          </div>
          <ChevronUp
            size={18}
            className={`bottom-sheet-chevron${expanded ? ' bottom-sheet-chevron--up' : ''}`}
            aria-hidden
          />
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </>
  );
}
