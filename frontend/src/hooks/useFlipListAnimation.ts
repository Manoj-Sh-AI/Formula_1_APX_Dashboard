import { useLayoutEffect, useRef, type RefObject } from "react";

const ITEM_SELECTOR = "[data-flip-key]";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function measurePositions(container: HTMLElement): Map<string, number> {
  const positions = new Map<string, number>();
  container.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((el) => {
    const key = el.dataset.flipKey;
    if (key) positions.set(key, el.getBoundingClientRect().top);
  });
  return positions;
}

export function useFlipListAnimation(
  containerRef: RefObject<HTMLElement | null>,
  itemKeys: string[],
) {
  const positionsRef = useRef<Map<string, number>>(new Map());
  const isFirstMount = useRef(true);
  const prevKeysRef = useRef<string>("");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const keysSignature = itemKeys.join("|");
    const currentPositions = measurePositions(container);

    if (isFirstMount.current) {
      isFirstMount.current = false;
      positionsRef.current = currentPositions;
      prevKeysRef.current = keysSignature;
      return;
    }

    const prevKeys = prevKeysRef.current;
    prevKeysRef.current = keysSignature;

    if (prevKeys && prevKeys !== keysSignature) {
      const prevKeyList = prevKeys.split("|");
      const keysChanged =
        prevKeyList.length !== itemKeys.length ||
        itemKeys.some((key) => !prevKeyList.includes(key));
      if (keysChanged) {
        positionsRef.current = currentPositions;
        return;
      }
    }

    const prevPositions = positionsRef.current;
    positionsRef.current = currentPositions;

    if (prefersReducedMotion()) return;

    const moved: HTMLElement[] = [];

    container.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((el) => {
      const key = el.dataset.flipKey;
      if (!key) return;

      const prevTop = prevPositions.get(key);
      const newTop = currentPositions.get(key);
      if (prevTop === undefined || newTop === undefined) return;

      const deltaY = prevTop - newTop;
      if (Math.abs(deltaY) < 0.5) return;

      el.style.transition = "none";
      el.style.transform = `translateY(${deltaY}px)`;
      el.classList.add("is-reordering");
      moved.push(el);
    });

    if (moved.length === 0) return;

    moved[0].offsetHeight;

    requestAnimationFrame(() => {
      moved.forEach((el) => {
        el.style.transition = "";
        el.style.transform = "";
      });

      window.setTimeout(() => {
        moved.forEach((el) => el.classList.remove("is-reordering"));
      }, 320);
    });
  }, [containerRef, itemKeys.join("|")]);
}
