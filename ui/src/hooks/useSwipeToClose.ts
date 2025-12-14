import { useRef, useCallback } from 'react';

/**
 * Custom hook for handling swipe-to-close gesture on mobile devices
 * @param onClose - Callback function to execute when swipe threshold is met
 * @param threshold - Minimum swipe distance in pixels to trigger close (default: 100)
 * @returns Object containing touch event handlers
 */
export function useSwipeToClose(onClose: () => void, threshold = 100) {
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (deltaY > threshold) {
        onClose();
      }
      touchStartY.current = null;
    },
    [onClose, threshold]
  );

  return { handleTouchStart, handleTouchEnd };
}
