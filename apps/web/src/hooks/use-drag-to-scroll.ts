"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAG_THRESHOLD_PX = 5;

const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], [data-no-drag-scroll]';

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function useDragToScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const dragState = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    scrollLeft: number;
    didDrag: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    didDrag: false,
  });
  const [isScrollable, setIsScrollable] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const updateScrollable = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    setIsScrollable(element.scrollWidth > element.clientWidth + 1);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    updateScrollable();

    const resizeObserver = new ResizeObserver(updateScrollable);
    resizeObserver.observe(element);

    const mutationObserver = new MutationObserver(updateScrollable);
    mutationObserver.observe(element, { childList: true, subtree: true });

    const resetDragState = () => {
      dragState.current.pointerId = null;
      dragState.current.didDrag = false;
      setIsDragging(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (event.pointerType === "touch") return;
      if (!isScrollable) return;
      if (isInteractiveTarget(event.target)) return;

      dragState.current = {
        pointerId: event.pointerId,
        startX: event.pageX,
        startY: event.pageY,
        scrollLeft: element.scrollLeft,
        didDrag: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const state = dragState.current;
      if (state.pointerId !== event.pointerId) return;

      const deltaX = event.pageX - state.startX;
      const deltaY = event.pageY - state.startY;

      if (!state.didDrag) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          resetDragState();
          return;
        }

        state.didDrag = true;
        setIsDragging(true);
        element.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
      element.scrollLeft = state.scrollLeft - deltaX;
    };

    const onPointerEnd = (event: PointerEvent) => {
      const state = dragState.current;
      if (state.pointerId !== event.pointerId) return;

      if (state.didDrag) {
        const suppressClick = (clickEvent: MouseEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
        };
        element.addEventListener("click", suppressClick, {
          capture: true,
          once: true,
        });
      }

      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }

      resetDragState();
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerEnd);
    element.addEventListener("pointercancel", onPointerEnd);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerEnd);
      element.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [isScrollable, updateScrollable]);

  return { ref, isScrollable, isDragging };
}
