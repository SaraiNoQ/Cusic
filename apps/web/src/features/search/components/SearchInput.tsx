import styles from '../../player/PlayerScreen.module.css';

export function SearchInput({
  value,
  isSearching,
  onChange,
}: Readonly<{
  value: string;
  isSearching: boolean;
  onChange: (value: string) => void;
}>) {
  return (
    <div className={styles.searchForm}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by title, artist, album, mood"
      />
      <button type="button" className={styles.searchAction}>
        {isSearching ? 'Searching…' : 'Live'}
      </button>
    </div>
  );
}
