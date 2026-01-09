export function HomeTab(props: {
  isLaunching: boolean
  error?: string
  onPlayMinecraft: () => void
}) {
  return (
    <div className="main-content">
      <div className="content-header">
        <h1 className="content-title">Home</h1>
        <p className="content-subtitle">This is where you start Minecraft</p>
      </div>

      <section className="status-card">
        <div className="status-content">
          <button
            type="button"
            className="button-primary button-large"
            onClick={props.onPlayMinecraft}
            disabled={props.isLaunching}
          >
            {props.isLaunching ? 'Starting…' : 'Play Minecraft'}
          </button>
          {props.error ? (
            <div className="status-error" style={{ marginTop: '1rem' }}>
              <p className="error-message">{props.error}</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}


