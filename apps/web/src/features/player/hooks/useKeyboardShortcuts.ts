'use client';

import { useEffect } from 'react';

interface UseKeyboardShortcutsParams {
  onTogglePlayPause: () => void;
  onCloseOverlays: () => void;
}

/**
 * Global keyboard shortcuts:
 * - Space → toggle play/pause
 * - Escape → close any open overlay (search, chat, queue, recommendations, imports, auth)
 *
 * Neither fires when the user is typing inside an input or textarea.
 */
export function useKeyboardShortcuts({
  onTogglePlayPause,
  onCloseOverlays,
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tag = target.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable;

      if (isEditable) return;

      if (event.key === ' ') {
        event.preventDefault();
        onTogglePlayPause();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseOverlays();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlayPause, onCloseOverlays]);
}
