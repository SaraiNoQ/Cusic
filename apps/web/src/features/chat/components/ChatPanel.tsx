'use client';

import { initialChatMessages, useChatStore } from '../../../store/chat-store';
import styles from '../../player/PlayerScreen.module.css';
import { ChatComposer } from './ChatComposer';

export function ChatPanel({
  messages,
  input,
  isPending,
  currentTrackTitle,
  onInputChange,
  onSubmit,
  onOpenConversation,
}: Readonly<{
  messages: import('@music-ai/shared').ChatMessageVm[];
  input: string;
  isPending: boolean;
  currentTrackTitle: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onOpenConversation: () => void;
}>) {
  const streamingMessageId = useChatStore((state) => state.streamingMessageId);
  const bootMessageId = initialChatMessages[0]?.id;
  const hasConversation = messages.some(
    (message) => message.id !== bootMessageId,
  );
  const isSessionActive =
    hasConversation || isPending || Boolean(streamingMessageId);

  return (
    <section className={styles.chatSection}>
      <div className={styles.connectionLine}>
        <span />
        <p>Connected to Cusic server</p>
        <span />
      </div>

      <div className={styles.chatSurface}>
        {isSessionActive ? (
          <>
            <div className={styles.djMessageRow}>
              <div className={styles.djAvatar} aria-hidden="true">
                <span className={styles.djHelmet} />
              </div>

              <div className={styles.djCopy}>
                <span className={styles.djName}>CUSIC</span>
                <article className={styles.djBubble}>
                  {(() => {
                    const visibleMessages = messages.filter(
                      (m) => m.id !== bootMessageId,
                    );
                    if (visibleMessages.length === 0) {
                      return (
                        <p>
                          {streamingMessageId
                            ? 'Transmitting your live DJ reply...'
                            : isPending
                              ? 'Calibrating a new transmission path through the current queue...'
                              : 'AI DJ session live. Open the conversation deck to continue with requests, explanations, and queue changes.'}
                        </p>
                      );
                    }
                    return visibleMessages.map((message) => (
                      <div
                        key={message.id}
                        className={
                          message.role === 'assistant'
                            ? `${styles.djMiniMessage} ${styles.djMiniAssistant}`
                            : `${styles.djMiniMessage} ${styles.djMiniUser}`
                        }
                      >
                        <span className={styles.djMiniRole}>
                          {message.role === 'assistant' ? 'CUSIC' : 'YOU'}
                        </span>
                        <span className={styles.djMiniText}>
                          {message.text}
                        </span>
                      </div>
                    ));
                  })()}
                </article>
                <div className={styles.replyRail}>
                  <button type="button" onClick={onOpenConversation}>
                    OPEN AI DJ
                  </button>
                </div>
              </div>
            </div>

            {currentTrackTitle ? (
              <div className={styles.nowPlayingLine}>
                Now playing: {currentTrackTitle}
              </div>
            ) : null}
          </>
        ) : (
          <div className={styles.chatIdleState}>
            <button
              type="button"
              className={styles.chatEntryButton}
              onClick={onOpenConversation}
            >
              OPEN AI DJ
            </button>
          </div>
        )}

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
