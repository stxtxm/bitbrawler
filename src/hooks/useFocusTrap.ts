import { useEffect, useRef, useCallback } from 'react';

/**
 * Focus trap hook for modals.
 *
 * - Traps Tab/Shift+Tab focus within the modal container
 * - Calls onClose when Escape is pressed
 * - Moves focus into the modal on mount
 * - Restores focus to the previously focused element on unmount
 *
 * @param open - Whether the modal is open
 * @param onClose - Callback when Escape is pressed
 * @returns A ref to attach to the modal container element
 */
export const useFocusTrap = <T extends HTMLElement>(open: boolean, onClose?: () => void) => {
    const containerRef = useRef<T | null>(null);
    const previousActiveElement = useRef<Element | null>(null);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose?.();
                return;
            }

            if (e.key !== 'Tab') return;

            const container = containerRef.current;
            if (!container) return;

            const focusableElements = container.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            if (focusableElements.length === 0) {
                e.preventDefault();
                return;
            }

            e.preventDefault();

            const currentIndex = Array.prototype.indexOf.call(
                focusableElements,
                document.activeElement
            );

            let nextIndex: number;
            if (e.shiftKey) {
                nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
            } else {
                nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
            }

            focusableElements[nextIndex].focus();
        },
        [onClose]
    );

    useEffect(() => {
        if (!open) return;

        // Store the previously focused element so we can restore focus on close
        previousActiveElement.current = document.activeElement;

        // Move focus into the modal
        const timer = requestAnimationFrame(() => {
            const container = containerRef.current;
            if (!container) return;

            const focusable = container.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            if (focusable) {
                focusable.focus();
            } else {
                container.setAttribute('tabindex', '-1');
                container.focus();
            }
        });

        // Listen for keyboard events
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            cancelAnimationFrame(timer);
            document.removeEventListener('keydown', handleKeyDown);

            // Restore focus to the element that was focused before the modal opened
            const prev = previousActiveElement.current;
            if (prev && 'focus' in prev && typeof (prev as HTMLElement).focus === 'function') {
                (prev as HTMLElement).focus();
            }
        };
    }, [open, handleKeyDown]);

    return containerRef;
};
