'use client';

import { FormEvent, useState } from 'react';
import styles from '../../player/PlayerScreen.module.css';

export function AuthPanel({
  isOpen,
  isPending,
  error,
  cooldownSeconds,
  onClose,
  onRequestCode,
  onLogin,
}: Readonly<{
  isOpen: boolean;
  isPending: boolean;
  error: string | null;
  cooldownSeconds: number;
  onClose: () => void;
  onRequestCode: (email: string) => Promise<void>;
  onLogin: (email: string, code: string) => Promise<void>;
}>) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleRequestCode = async () => {
    if (!email.trim()) {
      return;
    }
    await onRequestCode(email.trim());
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !code.trim()) {
      return;
    }
    void onLogin(email.trim(), code.trim());
  };

  return (
    <section className={styles.overlay}>
      <div className={styles.overlayFog} onClick={onClose} aria-hidden="true" />
      <form className={styles.authCard} onSubmit={handleSubmit}>
        <header className={styles.searchHeader}>
          <div>
            <span className={styles.searchEyebrow}>CREW ACCESS</span>
            <h2>Email verification</h2>
          </div>
          <button
            type="button"
            className={styles.searchClose}
            onClick={onClose}
          >
            CLOSE
          </button>
        </header>

        <div className={styles.authFields}>
          <label className={styles.authField}>
            <span>EMAIL</span>
            <input
              value={email}
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
            />
          </label>
          <label className={styles.authField}>
            <span>CODE</span>
            <input
              value={code}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
        </div>

        {error ? <p className={styles.authError}>{error}</p> : null}

        <div className={styles.authActions}>
          <button
            type="button"
            className={styles.searchAction}
            disabled={isPending || !email.trim()}
            onClick={() => void handleRequestCode()}
          >
            {cooldownSeconds > 0 ? `SENT ${cooldownSeconds}s` : 'SEND CODE'}
          </button>
          <button
            type="submit"
            className={styles.authPrimary}
            disabled={isPending || !email.trim() || !code.trim()}
          >
            {isPending ? 'VERIFYING' : 'LOGIN'}
          </button>
        </div>
      </form>
    </section>
  );
}
