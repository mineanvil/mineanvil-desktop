export function MicrosoftSignInScreen(props: {
  isSigningIn: boolean
  error?: string
  onSignIn: () => void
}) {
  return (
    <div className="setup-shell">
      <div className="setup-card">
        <h1 className="setup-title">Microsoft Sign-in</h1>
        <p className="setup-subtitle">Sign in with your Microsoft account to verify Minecraft ownership</p>
        <p className="setup-secondary">We&apos;ll open your browser to complete sign-in</p>

        {props.error ? (
          <div className="setup-error">
            <p className="error-message">{props.error}</p>
          </div>
        ) : null}

        <div className="setup-actions">
          <button
            type="button"
            className="button-primary button-large"
            onClick={props.onSignIn}
            disabled={props.isSigningIn}
          >
            {props.isSigningIn ? 'Signing in…' : 'Sign in with Microsoft'}
          </button>
        </div>
      </div>
    </div>
  )
}


