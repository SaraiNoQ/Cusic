'use client';

import type { ChatMessageVm } from '@music-ai/shared';
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
  messages: ChatMessageVm[];
  input: string;
  isPending: boolean;
  currentTrackTitle: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onOpenConversation: () => void;
}>) {
  const streamingMessageId = useChatStore((state) => state.streamingMessageId);
  const bootMessageId = initialChatMessages[0]?.id;
  const visibleMessages = messages.filter((m) => m.id !== bootMessageId);
  const hasConversation = visibleMessages.length > 0;
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
            {currentTrackTitle ? (
              <div className={styles.nowPlayingLine}>
                Now playing: {currentTrackTitle}
              </div>
            ) : null}

            <div className={styles.messageList}>
              {visibleMessages.map((message) => {
                const hasActions = (message.actions?.length ?? 0) > 0;

                return (
                  <article
                    key={message.id}
                    className={
                      message.role === 'assistant'
                        ? `${styles.chatBubble} ${styles.chatBubbleAssistant}`
                        : `${styles.chatBubble} ${styles.chatBubbleUser}`
                    }
                  >
                    <div className={styles.chatBubbleTopline}>
                      <span className={styles.chatRole}>
                        {message.role === 'assistant' ? 'AI DJ' : 'YOU'}
                      </span>
                      {message.intent ? (
                        <span className={styles.chatBubbleIndex}>
                          {message.intent.toUpperCase()}
                        </span>
                      ) : (
                        <span className={styles.chatBubbleIndex}>TX</span>
                      )}
                    </div>
                    <p>{message.text}</p>
                    {message.role === 'assistant' && hasActions ? (
                      <div className={styles.chatBubbleActions}>
                        <span>
                          {message.actions
                            ? `${message.actions.length} track${message.actions.length > 1 ? 's' : ''} queued`
                            : null}
                        </span>
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {isPending ? (
                <article
                  className={`${styles.chatBubble} ${styles.chatBubbleAssistant}`}
                >
                  <div className={styles.chatBubbleTopline}>
                    <span className={styles.chatRole}>AI DJ</span>
                    <span className={styles.chatBubbleIndex}>LIVE</span>
                  </div>
                  <p>
                    Calibrating a new transmission path through the current
                    library…
                  </p>
                </article>
              ) : null}
            </div>
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
