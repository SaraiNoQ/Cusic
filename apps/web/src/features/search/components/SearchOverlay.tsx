import type { ContentItemDto } from '@music-ai/shared';
import styles from '../../player/PlayerScreen.module.css';
import { SearchInput } from './SearchInput';
import { SearchResultList } from './SearchResultList';

export function SearchOverlay({
  isOpen,
  query,
  isSearching,
  total,
  items,
  onClose,
  onQueryChange,
  onPlay,
  onQueue,
  onAssist,
}: Readonly<{
  isOpen: boolean;
  query: string;
  isSearching: boolean;
  total: number;
  items: ContentItemDto[];
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onPlay: (track: ContentItemDto) => void;
  onQueue: (track: ContentItemDto) => void;
  onAssist: (track: ContentItemDto) => void;
}>) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className={styles.overlay}>
      <div className={styles.searchOverlayCard}>
        <header className={styles.overlayHeader}>
          <div>
            <p className={styles.eyebrow}>Search Surface</p>
            <h2>Inject new material into the deck</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}>
            Close
          </button>
        </header>

        <SearchInput
          value={query}
          isSearching={isSearching}
          onChange={onQueryChange}
        />
        <p className={styles.chatStatus}>
          {total} items wired into the current demo catalog.
        </p>

        <SearchResultList
          items={items}
          onPlay={onPlay}
          onQueue={onQueue}
          onAssist={onAssist}
        />
      </div>
    </section>
  );
}
