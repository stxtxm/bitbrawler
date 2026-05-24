import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * Helper component that uses the useFocusTrap hook for testing.
 */
function TestModal({ open, onClose }: { open: boolean; onClose?: () => void }) {
    const ref = useFocusTrap<HTMLDivElement>(open, onClose);

    if (!open) return null;

    return (
        <div ref={ref} data-testid="modal" role="dialog" aria-modal="true">
            <button data-testid="btn-first">First</button>
            <button data-testid="btn-second">Second</button>
            <button data-testid="btn-last">Last</button>
        </div>
    );
}

function TestModalNoFocusable({ open, onClose }: { open: boolean; onClose?: () => void }) {
    const ref = useFocusTrap<HTMLDivElement>(open, onClose);

    if (!open) return null;

    return (
        <div ref={ref} data-testid="modal-empty" role="dialog" aria-modal="true">
            <p>No focusable elements here</p>
        </div>
    );
}

describe('useFocusTrap', () => {
    beforeEach(() => {
        // Set up a button outside the modal to test focus restoration
        const outsideBtn = document.createElement('button');
        outsideBtn.setAttribute('data-testid', 'outside-btn');
        outsideBtn.textContent = 'Outside';
        document.body.appendChild(outsideBtn);
        outsideBtn.focus();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should move focus to the first focusable element when opened', async () => {
        const handleClose = vi.fn();
        const { rerender } = render(<TestModal open={false} onClose={handleClose} />);

        // Re-render with open=true
        rerender(<TestModal open={true} onClose={handleClose} />);

        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByTestId('btn-first'));
        });
    });

    it('should call onClose when Escape is pressed', async () => {
        const handleClose = vi.fn();
        render(<TestModal open={true} onClose={handleClose} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('should cycle focus with Tab key', async () => {
        const handleClose = vi.fn();
        render(<TestModal open={true} onClose={handleClose} />);

        // Focus should start on first button
        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByTestId('btn-first'));
        });

        // Tab should move to second button
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(document.activeElement).toBe(screen.getByTestId('btn-second'));

        // Tab should move to last button
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(document.activeElement).toBe(screen.getByTestId('btn-last'));

        // Tab on last button should cycle back to first
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(document.activeElement).toBe(screen.getByTestId('btn-first'));
    });

    it('should cycle focus backwards with Shift+Tab', async () => {
        const handleClose = vi.fn();
        render(<TestModal open={true} onClose={handleClose} />);

        // Focus should start on first button
        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByTestId('btn-first'));
        });

        // Shift+Tab on first button should cycle to last
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(screen.getByTestId('btn-last'));

        // Shift+Tab again should go to second button
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(screen.getByTestId('btn-second'));
    });

    it('should restore focus to the previously focused element when closed', async () => {
        const handleClose = vi.fn();
        const { rerender } = render(<TestModal open={true} onClose={handleClose} />);

        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByTestId('btn-first'));
        });

        // Close the modal
        rerender(<TestModal open={false} onClose={handleClose} />);

        // Focus should be restored to the outside button (the previously focused element)
        expect(document.activeElement).toBe(screen.getByTestId('outside-btn'));
    });

    it('should not throw when there are no focusable elements', async () => {
        const handleClose = vi.fn();
        render(<TestModalNoFocusable open={true} onClose={handleClose} />);

        await waitFor(() => {
            const modal = screen.getByTestId('modal-empty');
            expect(document.activeElement).toBe(modal);
        });

        // Pressing Tab should not throw
        expect(() => {
            fireEvent.keyDown(document, { key: 'Tab' });
        }).not.toThrow();
    });

    it('should not trap focus when open is false', () => {
        const handleClose = vi.fn();
        render(<TestModal open={false} onClose={handleClose} />);

        // No modal rendered, pressing keys should not call onClose
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(handleClose).not.toHaveBeenCalled();
    });
});
