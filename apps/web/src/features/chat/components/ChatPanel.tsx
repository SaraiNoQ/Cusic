'use client';

import { useEffect, useState } from 'react';
import type { ChatMessageVm } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';
import { ChatComposer } from './ChatComposer';

const fallbackTransmission =
  "This is Cusic. It's late on the line, and here's a song that moves with your breath. Let every phrase end in a whisper, then lift off the ground a little. After a long day with Claude Code, just breathe.";

function getLatestAssistantMessage(messages: ChatMessageVm[]) {
  return (
    [...messages].reverse().find((message) => message.role === 'assistant')
      ?.text ?? fallbackTransmission
  );
}

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
}: Readonly<{
  messages: ChatMessageVm[];
  input: string;
  isPending: boolean;
  prompts: string[];
  statusText: string;
  currentTrackTitle: string | null;
  onInputChange: (value: string) => void;
  onPromptSelect: (prompt: string) => void;
  onSubmit: () => void;
}>) {
  const [time, setTime] = useState('21:09');
  const transmission = isPending
    ? 'Calibrating a new transmission path through the current library...'
    : getLatestAssistantMessage(messages);

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
              <p>{transmission}</p>
            </article>
            <div className={styles.replyRail}>
              <span>{time}</span>
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
