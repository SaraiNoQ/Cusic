import styles from '../PlayerScreen.module.css';

export function SearchTrigger({
  onClick,
}: Readonly<{
  onClick: () => void;
}>) {
  return (
    <button type="button" className={styles.iconButton} onClick={onClick}>
      搜索
    </button>
  );
}
