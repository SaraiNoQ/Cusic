import type { ChatMessageVm } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';
import { ChatComposer } from './ChatComposer';
import { ChatMessageList } from './ChatMessageList';
import { PromptChips } from './PromptChips';

export function ChatOverlay({
  isOpen,
  messages,
  input,
  isPending,
  prompts,
  onClose,
  onInputChange,
  onPromptSelect,
  onSubmit,
}: Readonly<{
  isOpen: boolean;
  messages: ChatMessageVm[];
  input: string;
  isPending: boolean;
  prompts: string[];
  onClose: () => void;
  onInputChange: (value: string) => void;
  onPromptSelect: (prompt: string) => void;
  onSubmit: () => void;
}>) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className={styles.overlay}>
      <div className={styles.overlayFog} onClick={onClose} aria-hidden="true" />
      <div className={styles.chatOverlayCard}>
        <header className={styles.searchHeader}>
          <div>
            <span className={styles.searchEyebrow}>AI DJ CHANNEL</span>
            <h2>Conversation deck</h2>
          </div>
          <button
            type="button"
            className={styles.searchClose}
            onClick={onClose}
          >
            CLOSE
          </button>
        </header>

        <div className={styles.chatOverlayBody}>
          <PromptChips prompts={prompts} onSelect={onPromptSelect} />
          <ChatMessageList messages={messages} isPending={isPending} />
          <ChatComposer
            value={input}
            isPending={isPending}
            onChange={onInputChange}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </section>
  );
}
