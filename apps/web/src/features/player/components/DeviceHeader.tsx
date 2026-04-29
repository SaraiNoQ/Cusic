import Link from 'next/link';
import { useUiStore } from '../../../store/ui-store';
import styles from '../PlayerScreen.module.css';
import { CusicLogo } from './CusicLogo';

export function DeviceHeader({
  onOpenSearch,
  onOpenAuth,
  onLogout,
  userLabel,
}: Readonly<{
  onOpenSearch: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  userLabel?: string | null;
  isPlaying: boolean;
  statusText: string;
}>) {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  return (
    <header className={styles.deviceHeader}>
      <button
        type="button"
        className={styles.brandMark}
        onClick={onOpenSearch}
        aria-label="Open library search"
      >
        <span className={styles.brandLogo}>
          <CusicLogo className={styles.brandLogoSvg} />
        </span>
      </button>

      <div className={styles.headerActions}>
        <Link
          href="/settings"
          className={styles.settingsGear}
          aria-label="Settings"
        >
          <span aria-hidden="true">{'\u2699'}</span>
        </Link>

        <button
          type="button"
          className={styles.loginButton}
          onClick={userLabel ? onLogout : onOpenAuth}
        >
          {userLabel ? 'LOGOUT' : 'LOGIN'}
        </button>
        {userLabel ? (
          <span className={styles.userCallsign}>{userLabel}</span>
        ) : null}
        <button
          type="button"
          className={styles.searchButton}
          onClick={onOpenSearch}
          aria-label="Search library"
        >
          <span className={styles.searchGlyph} aria-hidden="true" />
          SEARCH
        </button>

        <div className={styles.headerSegmented} aria-label="Display mode">
          <button
            type="button"
            className={theme === 'dark' ? styles.headerSegmentActive : ''}
            onClick={() => setTheme('dark')}
          >
            DARK
          </button>
          <button
            type="button"
            className={theme === 'light' ? styles.headerSegmentActive : ''}
            onClick={() => setTheme('light')}
          >
            LIGHT
          </button>
        </div>
      </div>
    </header>
  );
}
