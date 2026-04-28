'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '../../../store/chat-store';
import styles from '../../player/PlayerScreen.module.css';
import { ChatComposer } from './ChatComposer';

function getTransmissionTime() {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export function ChatPanel({
  messages,
  input,
  isPending,
  statusText,
  currentTrackTitle,
  onInputChange,
  onSubmit,
  onOpenConversation,
}: Readonly<{
  messages: import('@music-ai/shared').ChatMessageVm[];
  input: string;
  isPending: boolean;
  prompts: string[];
  statusText: string;
  currentTrackTitle: string | null;
  onInputChange: (value: string) => void;
  onPromptSelect: (prompt: string) => void;
  onSubmit: () => void;
  onOpenConversation: () => void;
}>) {
  const [time, setTime] = useState('21:09');
  const streamingMessageId = useChatStore((state) => state.streamingMessageId);

  const messageCount = messages.length;
  const hasConversation = messageCount > 1;

  useEffect(() => {
    const update = () => setTime(getTransmissionTime());
    update();
    const timer = window.setInterval(update, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className={styles.chatSection}>
      <div className={styles.connectionLine}>
        <span />
        <p>Connected to Cusic server</p>
        <span />
      </div>

      <div className={styles.chatSurface}>
        <div className={styles.djMessageRow}>
          <div className={styles.djAvatar} aria-hidden="true">
            <span className={styles.djHelmet} />
          </div>

          <div className={styles.djCopy}>
            <span className={styles.djName}>CUSIC</span>
            <article className={styles.djBubble}>
              {isPending || streamingMessageId ? (
                <p>
                  {streamingMessageId
                    ? 'Transmitting...'
                    : 'Calibrating a new transmission path...'}
                </p>
              ) : (
                <p>
                  {hasConversation
                    ? `AI DJ session active — ${messageCount} messages in lane. Open the console to continue.`
                    : "This is Cusic. Send a message to start a live DJ session — I'll pick tracks that fit your mood, time, and taste."}
                </p>
              )}
            </article>
            <div className={styles.replyRail}>
              <span>{time}</span>
              <button type="button" onClick={onOpenConversation}>
                OPEN AI DJ
              </button>
              <button type="button">▶ REPLAY</button>
            </div>
          </div>
        </div>

        <div className={styles.nowPlayingLine}>
          Now playing: {currentTrackTitle ?? 'If - Bread'}
        </div>

        <div className={styles.operatorBadge} aria-label={statusText}>
          <span>MMGUO</span>
          <strong>{time}</strong>
          <i />
        </div>

        <ChatComposer
          value={input}
          isPending={isPending}
          onChange={onInputChange}
          onSubmit={onSubmit}
        />
      </div>
    </section>
  );
}
