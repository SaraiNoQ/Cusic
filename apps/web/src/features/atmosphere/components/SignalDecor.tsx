import styles from '../../player/PlayerScreen.module.css';

export function SignalDecor() {
  return (
    <div className={styles.signalDecor} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
