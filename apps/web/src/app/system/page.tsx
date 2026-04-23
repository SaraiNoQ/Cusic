export default function SystemPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background:
          'radial-gradient(circle at 50% 18%, rgba(255,178,99,0.14), transparent 0 18%), linear-gradient(180deg, #040912 0%, #09121c 52%, #060b12 100%)',
      }}
    >
      <section
        style={{
          width: 'min(100%, 420px)',
          borderRadius: '28px',
          padding: '24px',
          border: '1px solid rgba(130, 175, 220, 0.16)',
          background: 'rgba(8, 15, 24, 0.82)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.36)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(191,210,231,0.72)',
          }}
        >
          System
        </p>
        <h1 style={{ margin: '10px 0 8px', fontSize: '22px' }}>
          Web runtime is online
        </h1>
        <p
          style={{
            margin: 0,
            lineHeight: 1.6,
            color: 'rgba(214,225,238,0.82)',
          }}
        >
          The current web surface is organized around a split mobile player:
          top-half playback, bottom-half AI conversation, and an overlay search
          surface.
        </p>
      </section>
    </main>
  );
}
