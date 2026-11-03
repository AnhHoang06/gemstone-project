import { useCallback, useEffect, useRef, useState } from 'react';

/** Hover intent delay so sweeping the pointer across the grid does not flash every card. */
export const SPEC_HOVER_DELAY_MS = 120;
/** Focus within this window after a press on the card counts as pointer focus (touch emulates mousedown late). */
const POINTER_FOCUS_WINDOW_MS = 1000;

function isKeyboardFocus(target, lastPointerDown) {
  try {
    if (target?.matches?.(':focus-visible')) return true;
  } catch {
    // Older engines without :focus-visible fall through to the pointer heuristic.
  }
  return Date.now() - lastPointerDown > POINTER_FOCUS_WINDOW_MS;
}

/**
 * State for the product-card spec overlay.
 * - mouse/pen hover on the card (after SPEC_HOVER_DELAY_MS) or keyboard focus inside the card reveals it;
 * - `toggle` pins it open/closed (touch button); Esc and a tap outside the toggle close it;
 * - Esc also dismisses a hover/focus reveal until the pointer or focus leaves the card (WCAG 1.4.13).
 */
export default function useSpecReveal() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hoverTimer = useRef(0);
  const lastPointerDown = useRef(0);
  const toggleRef = useRef(null);
  const visible = !dismissed && (hovered || focused || pinned);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = event => {
      // Esc already handled by an open menu/combobox should not also dismiss this card.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setPinned(false);
      setDismissed(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  useEffect(() => {
    if (!pinned) return undefined;
    const onClick = event => {
      if (toggleRef.current?.contains(event.target)) return;
      setPinned(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pinned]);

  const toggle = useCallback(() => {
    if (visible) {
      setPinned(false);
      setDismissed(true);
    } else {
      setPinned(true);
      setDismissed(false);
    }
  }, [visible]);

  const cardProps = {
    onPointerEnter(event) {
      if (event.pointerType === 'touch') return;
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => setHovered(true), SPEC_HOVER_DELAY_MS);
    },
    onPointerLeave(event) {
      if (event.pointerType === 'touch') return;
      window.clearTimeout(hoverTimer.current);
      setHovered(false);
      if (!event.currentTarget.contains(document.activeElement)) setDismissed(false);
    },
    onPointerDown() {
      lastPointerDown.current = Date.now();
    },
    onFocus(event) {
      if (isKeyboardFocus(event.target, lastPointerDown.current)) setFocused(true);
    },
    onBlur(event) {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setFocused(false);
      setDismissed(false);
    },
  };

  return { visible, pinned, toggle, toggleRef, cardProps };
}
