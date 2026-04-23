import styles from '../../player/PlayerScreen.module.css';

export function PromptChips({
  prompts,
  onSelect,
}: Readonly<{
  prompts: string[];
  onSelect: (prompt: string) => void;
}>) {
  return (
    <div className={styles.promptRow}>
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          className={styles.promptChip}
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
