import Link from 'next/link';
import styles from './KnowledgeCard.module.css';

interface KnowledgeSource {
  title: string;
  url?: string;
  sourceType?: 'catalog' | 'web_search';
}

interface RelatedContent {
  contentId: string;
  title: string;
}

export interface KnowledgeCardProps {
  title?: string;
  summaryText: string;
  sources?: KnowledgeSource[];
  relatedContent?: RelatedContent[];
  isLoading?: boolean;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  catalog: '来自曲库',
  web_search: '来自网络',
};

export function KnowledgeCard({
  title,
  summaryText,
  sources,
  relatedContent,
  isLoading = false,
}: Readonly<KnowledgeCardProps>) {
  if (isLoading) {
    return (
      <article className={`${styles.card} ${styles.shimmer}`} aria-busy="true">
        {title ? <h3 className={styles.title}>{title}</h3> : null}
        <div className={styles.shimmerLine} />
        <div className={styles.shimmerLine} />
        <div className={styles.shimmerLine} />
      </article>
    );
  }

  return (
    <article className={styles.card}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      <p className={styles.summary}>{summaryText}</p>

      {sources && sources.length > 0 ? (
        <div className={styles.sectionRow}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Sources</span>
            <span className={styles.sourceCountBadge}>{sources.length}</span>
          </div>
          <ul className={styles.sourcesList}>
            {sources.map((source, index) => (
              <li key={index} className={styles.sourceItem}>
                <span className={styles.sourceTypeLabel}>
                  {source.sourceType
                    ? (SOURCE_TYPE_LABELS[source.sourceType] ??
                      source.sourceType)
                    : ''}
                </span>
                {source.url ? (
                  <a
                    href={source.url}
                    className={styles.sourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                  </a>
                ) : (
                  <span className={styles.sourceTitle}>{source.title}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {relatedContent && relatedContent.length > 0 ? (
        <div className={styles.sectionRow}>
          <span className={styles.sectionLabel}>Related Content</span>
          <ul className={styles.relatedList}>
            {relatedContent.map((item) => (
              <li key={item.contentId} className={styles.relatedItem}>
                <Link
                  href={`/track/${item.contentId}`}
                  className={styles.relatedLink}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
