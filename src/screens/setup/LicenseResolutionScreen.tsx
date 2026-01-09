export type LicenseResolutionOutcome = 'checking' | 'verified' | 'notFound'

export function LicenseResolutionScreen(props: {
  outcome: LicenseResolutionOutcome
  message?: string
  isChecking: boolean
  error?: string
  onOpenMinecraftWebsite: () => void
  onCheckAgain: () => void
  onContinueDemo: () => void
}) {
  return (
    <div className="setup-shell">
      <div className="setup-card">
        <h1 className="setup-title">Minecraft License</h1>

        {props.outcome === 'verified' ? (
          <p className="setup-subtitle">Minecraft license verified</p>
        ) : props.outcome === 'notFound' ? (
          <p className="setup-subtitle">We couldn&apos;t find a Minecraft license for this account</p>
        ) : (
          <p className="setup-subtitle">Checking your Minecraft license…</p>
        )}

        {props.message ? <p className="setup-secondary">{props.message}</p> : null}

        {props.error ? (
          <div className="setup-error">
            <p className="error-message">{props.error}</p>
          </div>
        ) : null}

        {props.outcome === 'notFound' ? (
          <div className="setup-actions setup-actions-column">
            <button type="button" className="button-secondary button-large" onClick={props.onOpenMinecraftWebsite}>
              Open Minecraft website
            </button>
            <button
              type="button"
              className="button-secondary button-large"
              onClick={props.onCheckAgain}
              disabled={props.isChecking}
            >
              {props.isChecking ? 'Checking…' : 'Check again'}
            </button>
            <button type="button" className="button-primary button-large" onClick={props.onContinueDemo}>
              Continue in Demo Mode
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}


