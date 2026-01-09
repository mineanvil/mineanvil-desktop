import { useState } from 'react'

export function CuratedWorldsTab(props: { onCreateAndLaunch?: () => void }) {
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="main-content">
      <div className="content-header">
        <h1 className="content-title">Curated Worlds</h1>
        <p className="content-subtitle">Pick a world and MineAnvil will create and launch it for you</p>
      </div>

      <section className="status-card">
        <div className="status-content">
          <p className="status-description">Curated worlds aren&apos;t available yet.</p>

          <button
            type="button"
            className="button-primary button-large"
            onClick={() => {
              setMessage('This isn’t available yet.')
              props.onCreateAndLaunch?.()
            }}
          >
            Create and Launch
          </button>

          {message ? (
            <p className="status-message" style={{ marginTop: '0.75rem' }}>
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}


