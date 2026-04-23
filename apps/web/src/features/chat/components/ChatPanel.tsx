import type { ChatMessageVm } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';
import { ChatComposer } from './ChatComposer';
import { ChatMessageList } from './ChatMessageList';
import { PromptChips } from './PromptChips';

export function ChatPanel({
  messages,
  input,
  isPending,
  prompts,
  onInputChange,
  onPromptSelect,
  onSubmit,
}: Readonly<{
  messages: ChatMessageVm[];
  input: string;
  isPending: boolean;
  prompts: string[];
  onInputChange: (value: string) => void;
  onPromptSelect: (prompt: string) => void;
  onSubmit: () => void;
}>) {
  return (
    <section className={styles.chatZone}>
      <header className={styles.chatHeader}>
        <div>
          <p className={styles.eyebrow}>AI DJ Channel</p>
          <h2>Persistent dialogue surface</h2>
        </div>
        <p className={styles.chatStatus}>
          The lower half stays online for recommendations, storytelling, and
          direct queue control.
        </p>
      </header>

      <ChatMessageList messages={messages} isPending={isPending} />
      <PromptChips prompts={prompts} onSelect={onPromptSelect} />
      <ChatComposer
        value={input}
        isPending={isPending}
        onChange={onInputChange}
        onSubmit={onSubmit}
      />
    </section>
  );
}
