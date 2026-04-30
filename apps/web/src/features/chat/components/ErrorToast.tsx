'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../../store/chat-store';
import styles from './ErrorToast.module.css';

/**
 * Displays API errors as a toast that auto-dismisses after 5 seconds.
 * Positioned at the bottom of the screen, styled with CSS variables.
 */
export function ErrorToast() {
  const chatError = useChatStore((state) => state.chatError);
  const clearChatError = useChatStore((state) => state.clearChatError);

  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      clearChatError();
    }, 260);
  }, [clearChatError]);

  useEffect(() => {
    if (chatError) {
      setVisible(true);
      setExiting(false);

      timerRef.current = setTimeout(() => {
        dismiss();
      }, 5000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [chatError, dismiss]);

  if (!visible || !chatError) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`${styles.toast} ${exiting ? styles.toastExit : styles.toastEnter}`}
    >
      {chatError}
    </div>
  );
}
