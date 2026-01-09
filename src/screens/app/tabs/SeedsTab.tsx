import { useState } from 'react'

type SeedItem = { name: string; seedValue: string; description: string }

const SEEDS: SeedItem[] = [
  { name: 'Mountain Vista', seedValue: '1234567890', description: 'A world with mountain ranges and valleys.' },
  { name: 'Coastal Haven', seedValue: '9876543210', description: 'A calm coastline with beaches and water.' },
  { name: 'Forest Grove', seedValue: '5555555555', description: 'A dense forest with plenty of trees.' },
]

export function SeedsTab(props: { onReturnToWorlds: () => void }) {
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="main-content">
      <div className="content-header">
        <h1 className="content-title">Seeds</h1>
        <p className="content-subtitle">Create a new world in Minecraft using a seed</p>
      </div>

      <section className="status-card">
        <div className="status-content">
          <div className="seeds-list">
            {SEEDS.map((seed) => (
              <div key={seed.seedValue} className="seed-row">
                <div className="seed-content">
                  <span className="seed-name">{seed.name}</span>
                  <span className="seed-description">{seed.description}</span>
                </div>
                <div className="seed-actions">
                  <span className="seed-value">{seed.seedValue}</span>
                  <button
                    type="button"
                    className="seed-create-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(seed.seedValue)
                        setMessage('Seed copied. Go to WORLDS to launch Minecraft.')
                      } catch {
                        setMessage('Go to WORLDS to launch Minecraft.')
                      } finally {
                        props.onReturnToWorlds()
                      }
                    }}
                  >
                    Create World
                  </button>
                </div>
              </div>
            ))}
          </div>

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


