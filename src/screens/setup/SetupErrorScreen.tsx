export function SetupErrorScreen(props: {
  error?: string
  onTryAgain: () => void
  onAskForHelp: () => void
  onViewDiagnostics: () => void
}) {
  return (
    <div className="setup-shell">
      <div className="setup-card">
        <h1 className="setup-title">Setup Error</h1>
        <p className="setup-subtitle">Something went wrong during setup.</p>
        <p className="setup-secondary">You can try again. If it keeps happening, ask for help or view diagnostics.</p>

        {props.error ? (
          <div className="setup-error">
            <p className="error-message">{props.error}</p>
          </div>
        ) : null}

        <div className="setup-actions setup-actions-column">
          <button type="button" className="button-primary button-large" onClick={props.onTryAgain}>
            Try again
          </button>
          <button type="button" className="button-secondary button-large" onClick={props.onAskForHelp}>
            Ask for help
          </button>
          <button type="button" className="button-secondary button-large" onClick={props.onViewDiagnostics}>
            View diagnostics
          </button>
        </div>
      </div>
    </div>
  )
}


