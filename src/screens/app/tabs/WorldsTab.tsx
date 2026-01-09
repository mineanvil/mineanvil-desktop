import type { LicenseMode } from '../../../ux/flowTypes'

export type UiWorld = {
  id: string
  name: string
  /** Unix epoch millis. Optional until the model is wired. */
  lastPlayed?: number
}

export function sortWorldsByLastPlayedDesc(worlds: UiWorld[]): UiWorld[] {
  return [...worlds].sort((a, b) => {
    const aLast = a.lastPlayed ?? 0
    const bLast = b.lastPlayed ?? 0
    if (aLast !== bLast) return bLast - aLast
    const nameCmp = a.name.localeCompare(b.name)
    if (nameCmp !== 0) return nameCmp
    return a.id.localeCompare(b.id)
  })
}

function lastPlayedLabel(lastPlayed?: number): string {
  if (!lastPlayed) return 'Last played: unknown'
  const d = new Date(lastPlayed)
  return `Last played: ${d.toLocaleDateString()}`
}

export function WorldsTab(props: {
  licenseMode: LicenseMode
  onPlayDemo: () => void
  localWorlds?: UiWorld[]
  remoteWorlds?: UiWorld[]
}) {
  if (props.licenseMode === 'demo') {
    return (
      <div className="main-content">
        <div className="content-header">
          <h1 className="content-title">Worlds</h1>
          <p className="content-subtitle">Your worlds appear here</p>
        </div>

        <section className="status-card">
          <div className="status-card-header">
            <h2 className="status-card-title">Demo World</h2>
          </div>
          <div className="status-content">
            <p className="status-description">Demo Mode includes one demo world.</p>
            <button type="button" className="button-primary" onClick={props.onPlayDemo}>
              Play Demo
            </button>
          </div>
        </section>
      </div>
    )
  }

  const local = sortWorldsByLastPlayedDesc(props.localWorlds ?? [])
  const remote = sortWorldsByLastPlayedDesc(props.remoteWorlds ?? [])

  return (
    <div className="main-content">
      <div className="content-header">
        <h1 className="content-title">Worlds</h1>
        <p className="content-subtitle">This is where you play and manage your Minecraft worlds</p>
      </div>

      <div className="status-grid">
        <section className="status-card">
          <div className="status-card-header">
            <h2 className="status-card-title">World Invites</h2>
          </div>
          <div className="status-content">
            <p className="status-description">No invites right now.</p>
          </div>
        </section>

        <section className="status-card">
          <div className="status-card-header">
            <h2 className="status-card-title">My Local Worlds</h2>
          </div>
          <div className="status-content">
            {local.length === 0 ? (
              <p className="status-description">No local worlds yet.</p>
            ) : (
              <div className="worlds-list">
                {local.map((w, idx) => (
                  <div key={w.id} className="world-row">
                    <div className="world-row-main">
                      <p className="world-row-name">
                        {w.name} {idx === 0 ? <span className="world-row-badge">Most recent</span> : null}
                      </p>
                      <p className="world-row-meta">{lastPlayedLabel(w.lastPlayed)}</p>
                    </div>
                    <div className="world-row-actions">
                      <button type="button" className="button-secondary button-small" disabled>
                        Launch
                      </button>
                      <button type="button" className="button-secondary button-small" disabled>
                        Backup
                      </button>
                      <button type="button" className="button-secondary button-small" disabled>
                        Delete
                      </button>
                      <button type="button" className="button-secondary button-small" disabled>
                        Share seed
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="status-description" style={{ marginTop: '0.75rem' }}>
              World actions will appear here as they become available.
            </p>
          </div>
        </section>

        <section className="status-card">
          <div className="status-card-header">
            <h2 className="status-card-title">My Remote Server Worlds</h2>
          </div>
          <div className="status-content">
            {remote.length === 0 ? (
              <p className="status-description">No remote worlds yet.</p>
            ) : (
              <div className="worlds-list">
                {remote.map((w) => (
                  <div key={w.id} className="world-row">
                    <div className="world-row-main">
                      <p className="world-row-name">{w.name}</p>
                      <p className="world-row-meta">{lastPlayedLabel(w.lastPlayed)}</p>
                    </div>
                    <div className="world-row-actions">
                      <button type="button" className="button-secondary button-small" disabled>
                        Launch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}


