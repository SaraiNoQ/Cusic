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
      {prompts.map((prompt, index) => (
        <button
          key={prompt}
          type="button"
          className={styles.promptChip}
          onClick={() => onSelect(prompt)}
        >
          <span className={styles.promptIndex}>
            {`0${index + 1}`.slice(-2)}
          </span>
          <span>{prompt}</span>
        </button>
      ))}
    </div>
  );
}
