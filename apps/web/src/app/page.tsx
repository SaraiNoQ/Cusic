export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">Music AI App / Editorial Workbench</div>
        <h1>
          A restrained listening room with an <span className="accent">AI DJ</span>{' '}
          at the center.
        </h1>
        <p>
          This bootstrap page anchors the design system direction: editorial,
          tactile, slightly retro-futurist, and optimized for player-first
          workflows.
        </p>
      </section>
      <section className="grid">
        <article className="card">
          <div className="eyebrow">Now Playing</div>
          <h2>Queue, playback controls, and session state live here.</h2>
          <p>
            The final product will merge player controls, AI actions, and
            recommendation context into a single operational workspace.
          </p>
        </article>
        <article className="card">
          <div className="eyebrow">System</div>
          <h2>Bootstrap status</h2>
          <ul>
            <li>Next.js App Router initialized</li>
            <li>Design tokens seeded</li>
            <li>API base expected at /api/v1</li>
          </ul>
          <a href="/system">Open system page</a>
        </article>
      </section>
    </main>
  );
}

