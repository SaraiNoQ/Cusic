import styles from '../PlayerScreen.module.css';

export function InputBar({
  prompts,
  input,
  isPending,
  onInputChange,
  onPromptSelect,
  onSubmit,
}: Readonly<{
  prompts: string[];
  input: string;
  isPending: boolean;
  onInputChange: (value: string) => void;
  onPromptSelect: (prompt: string) => void;
  onSubmit: () => void;
}>) {
  return (
    <section className={styles.inputBar}>
      <div className={styles.promptStrip}>
        {prompts.slice(0, 3).map((prompt) => (
          <button
            key={prompt}
            type="button"
            className={styles.promptCommand}
            onClick={() => onPromptSelect(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
      <form
        className={styles.inputForm}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Send command to AI DJ..."
          className={styles.inputField}
        />
        <button
          type="submit"
          className={styles.inputSubmit}
          disabled={isPending}
        >
          {isPending ? '...' : '↗'}
        </button>
      </form>
    </section>
  );
}
