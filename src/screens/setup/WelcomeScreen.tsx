import logoUrl from '../../assets/logo.png'

export function WelcomeScreen(props: { onGetStarted: () => void }) {
  return (
    <div className="setup-shell">
      <div className="setup-card">
        <div className="setup-brand">
          <img src={logoUrl} alt="MineAnvil" className="setup-logo" />
          <h1 className="setup-title">MineAnvil</h1>
        </div>

        <p className="setup-subtitle">MineAnvil makes Minecraft simple and safe for families</p>

        <div className="setup-actions">
          <button type="button" className="button-primary button-large" onClick={props.onGetStarted}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}


