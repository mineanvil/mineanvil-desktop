import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { getMineAnvilApi } from './bridge/mineanvil'
import type { AuthStatus, MineAnvilApi } from '../electron/src/shared/ipc-types'
import { buildDiagnosticsBundle, downloadDiagnosticsJson } from './diagnostics/export'
import { getRendererLogger } from './logging/renderer'
import { getSafetySignal, type SafetySignal } from './safety/safetySignal'

type NavSection = 'home' | 'account' | 'minecraft' | 'diagnostics'

function App() {
  const [currentSection, setCurrentSection] = useState<NavSection>('home')
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isFetchingStatus, setIsFetchingStatus] = useState<boolean>(false)
  const [explanationExpanded, setExplanationExpanded] = useState<boolean>(false)
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false)
  const [signInMessage, setSignInMessage] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false)
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null)
  const [launchPlanJson, setLaunchPlanJson] = useState<string | null>(null)
  const [launchPlanError, setLaunchPlanError] = useState<string | null>(null)
  const [launchPlanCanRetry, setLaunchPlanCanRetry] = useState<boolean>(true)
  const [isLoadingLaunchPlan, setIsLoadingLaunchPlan] = useState<boolean>(false)
  const [runtimeStatusJson, setRuntimeStatusJson] = useState<string | null>(null)
  const [runtimeStatusError, setRuntimeStatusError] = useState<string | null>(null)
  const [runtimeStatusCanRetry, setRuntimeStatusCanRetry] = useState<boolean>(true)
  const [isCheckingRuntime, setIsCheckingRuntime] = useState<boolean>(false)
  const [ensureRuntimeJson, setEnsureRuntimeJson] = useState<string | null>(null)
  const [ensureRuntimeError, setEnsureRuntimeError] = useState<string | null>(null)
  const [ensureRuntimeCanRetry, setEnsureRuntimeCanRetry] = useState<boolean>(true)
  const [isEnsuringRuntime, setIsEnsuringRuntime] = useState<boolean>(false)
  const [vanillaVersion, setVanillaVersion] = useState<string>('latest')
  const [installVanillaJson, setInstallVanillaJson] = useState<string | null>(null)
  const [installVanillaError, setInstallVanillaError] = useState<string | null>(null)
  const [installVanillaCanRetry, setInstallVanillaCanRetry] = useState<boolean>(true)
  const [isInstallingVanilla, setIsInstallingVanilla] = useState<boolean>(false)
  const [launchCmdJson, setLaunchCmdJson] = useState<string | null>(null)
  const [launchCmdError, setLaunchCmdError] = useState<string | null>(null)
  const [launchCmdCanRetry, setLaunchCmdCanRetry] = useState<boolean>(true)
  const [isLoadingLaunchCmd, setIsLoadingLaunchCmd] = useState<boolean>(false)
  const [launchVanillaJson, setLaunchVanillaJson] = useState<string | null>(null)
  const [launchVanillaError, setLaunchVanillaError] = useState<string | null>(null)
  const [launchVanillaCanRetry, setLaunchVanillaCanRetry] = useState<boolean>(true)
  const [isLaunchingVanilla, setIsLaunchingVanilla] = useState<boolean>(false)
  const [showRightPanel, setShowRightPanel] = useState<boolean>(false)

  const api = useMemo(() => getMineAnvilApi(), [])
  const logger = useMemo(() => getRendererLogger('ui'), [])

  const failureMessage = useCallback((res: { error?: string; failure?: { userMessage: string; canRetry?: boolean } }, fallback: string) => {
    return res.failure?.userMessage ?? res.error ?? fallback
  }, [])

  const fetchStatus = useCallback(
    async (reason: 'initial' | 'refresh') => {
      setIsFetchingStatus(true)
      setStatusError(null)
      try {
        const status = await api.authGetStatus()
        setAuthStatus(status)
        logger.info('auth status fetched', { reason, signedIn: status.signedIn })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setStatusError(msg)
        logger.info('auth status fetch failed', { reason, error: msg })
      } finally {
        setIsFetchingStatus(false)
      }
    },
    [api, logger],
  )

  useEffect(() => {
    void fetchStatus('initial')
  }, [fetchStatus])

  const isBrowserMode = typeof window !== 'undefined' && !window.mineanvil
  const ownershipState = authStatus?.signedIn ? authStatus.ownershipState : undefined
  const launchBlocked = !authStatus?.signedIn || ownershipState !== 'OWNED'
  // Minecraft is ready when launch is not blocked (signed in + owned)
  const minecraftReady = !launchBlocked

  const renderHomeContent = () => {
    // Get Safety Signal from existing app state
    const safetySignalInputs = authStatus
      ? {
          signedIn: authStatus.signedIn,
          ownershipState: authStatus.signedIn ? authStatus.ownershipState : undefined,
          minecraftReady,
        }
      : null
    const safetySignal = getSafetySignal(safetySignalInputs)
    const safetySignalClass = `safety-${safetySignal.signal}`

    // Get explanation text based on safety signal
    const getExplanationText = (signal: SafetySignal): string => {
      switch (signal) {
        case 'normal':
          return "MineAnvil checks your account and keeps Minecraft in a known-good state. If something changes, you'll see it here."
        case 'attention':
          return "MineAnvil needs one step before Minecraft can start. This is usually quick, and you won't break anything by waiting."
        case 'unsupported':
          return "MineAnvil can't safely manage this setup right now. This usually means the account isn't eligible or access is blocked."
      }
    }

    const explanationText = getExplanationText(safetySignal.signal)

    return (
      <div className="main-content">
        <div className="content-header">
          <h1 className="content-title">Minecraft made simple.</h1>
          <p className="content-subtitle">Set up once. Safe to use every day.</p>
        </div>

        {/* Safety Signal - Environment Status */}
        <section className={`status-card ${safetySignalClass}`} style={{ marginBottom: '1.5rem' }}>
          <div className="status-card-header">
            <h2 className="status-card-title">Environment Status</h2>
          </div>
          <div className="status-content">
            <h3 className="safety-signal-title">{safetySignal.title}</h3>
            <p className="safety-signal-body">{safetySignal.body}</p>
            {explanationText && (
              <>
                <button
                  type="button"
                  className="explanation-toggle"
                  onClick={() => setExplanationExpanded(!explanationExpanded)}
                  aria-expanded={explanationExpanded}
                  aria-controls="safety-signal-explanation"
                >
                  What does this mean?
                  <span className="explanation-chevron" aria-hidden="true">
                    {explanationExpanded ? '▴' : '▾'}
                  </span>
                </button>
                {explanationExpanded && (
                  <div id="safety-signal-explanation" className="explanation-panel">
                    <p className="explanation-text">{explanationText}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <div className="status-grid">
        {/* Account Status */}
        <section className="status-card">
          <div className="status-card-header">
            <h2 className="status-card-title">Account</h2>
            <button
              className="button-secondary button-small"
              onClick={() => {
                logger.info('auth status refresh clicked')
                void fetchStatus('refresh')
              }}
              disabled={isFetchingStatus}
            >
              {isFetchingStatus ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {statusError ? (
            <div className="status-error">
              <p className="error-message">{statusError}</p>
            </div>
          ) : authStatus ? (
            authStatus.signedIn ? (
              <div className="status-content">
                <div className="status-indicator status-success">
                  <span className="status-icon">✓</span>
                  <span className="status-text">Signed in</span>
                </div>
                <div className="status-details">
                  <p className="status-detail">
                    <span className="status-label">Name:</span>
                    <span className="status-value">{authStatus.displayName ?? 'Not available'}</span>
                  </p>
                  <p className="status-detail">
                    <span className="status-label">Minecraft:</span>
                    <span className="status-value">
                      {ownershipState === 'OWNED' ? 'Ready ✓' : ownershipState === 'NOT_OWNED' ? 'Not owned' : ownershipState === 'UNVERIFIED_APP_NOT_APPROVED' ? 'Verification pending' : 'Unknown'}
                    </span>
                  </p>
                </div>
                <button
                  className="button-primary"
                  onClick={() => {
                    void (async () => {
                      setIsSigningOut(true)
                      setSignOutMessage(null)
                      logger.info('auth sign-out clicked')
                      try {
                        const res = await api.authSignOut()
                        if (res.ok) {
                          setSignOutMessage('Signed out.')
                          logger.info('auth sign-out result', { ok: true })
                          await fetchStatus('refresh')
                        } else {
                          setSignOutMessage(failureMessage(res, 'Sign-out failed.'))
                          logger.info('auth sign-out result', { ok: false })
                        }
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err)
                        setSignOutMessage(msg)
                        logger.info('auth sign-out threw', { error: msg })
                      } finally {
                        setIsSigningOut(false)
                      }
                    })()
                  }}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? 'Signing out…' : 'Sign out'}
                </button>
                {signOutMessage ? <p className="status-message">{signOutMessage}</p> : null}
              </div>
            ) : (
              <div className="status-content">
                <div className="status-indicator status-warning">
                  <span className="status-icon">!</span>
                  <span className="status-text">Not signed in</span>
                </div>
                <p className="status-description">Please sign in with your Microsoft account to continue.</p>
                <button
                  className="button-primary"
                  onClick={() => {
                    void (async () => {
                      setIsSigningIn(true)
                      setSignInMessage(null)
                      logger.info('auth sign-in clicked')
                      try {
                        const res = await api.authSignIn()
                        if (res.ok) {
                          setSignInMessage('Sign-in started/completed successfully.')
                          logger.info('auth sign-in result', { ok: true })
                          await fetchStatus('refresh')
                        } else {
                          setSignInMessage(failureMessage(res, 'Sign-in failed.'))
                          logger.info('auth sign-in result', { ok: false, error: res.error ?? '(no error provided)' })
                        }
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err)
                        setSignInMessage(msg)
                        logger.info('auth sign-in threw', { error: msg })
                      } finally {
                        setIsSigningIn(false)
                      }
                    })()
                  }}
                  disabled={isSigningIn}
                >
                  {isSigningIn ? 'Signing in…' : 'Sign in with Microsoft'}
                </button>
                {signInMessage ? <p className="status-message">{signInMessage}</p> : null}
              </div>
            )
          ) : (
            <div className="status-content">
              <p className="status-loading">Loading account status…</p>
            </div>
          )}
        </section>

        {/* Launch Status */}
        {authStatus?.signedIn && ownershipState === 'OWNED' ? (
          <section className="status-card">
            <div className="status-card-header">
              <h2 className="status-card-title">Launch Minecraft</h2>
            </div>
            <div className="status-content">
              {launchBlocked ? (
                <div className="status-error">
                  <p className="error-message">
                    <strong>Cannot launch</strong> —{' '}
                    {!authStatus?.signedIn
                      ? 'please sign in to verify ownership.'
                      : ownershipState === 'NOT_OWNED'
                        ? 'this account does not own Minecraft: Java Edition.'
                        : ownershipState === 'UNVERIFIED_APP_NOT_APPROVED'
                          ? 'MineAnvil is not approved for Minecraft services yet, so ownership cannot be verified.'
                          : 'ownership could not be verified yet (try again later).'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="launch-actions">
                    <button
                      className="button-primary button-large"
                      onClick={() => {
                        void (async () => {
                          setIsLaunchingVanilla(true)
                          setLaunchVanillaError(null)
                          setLaunchVanillaCanRetry(true)
                          logger.info('launchVanilla clicked', { version: vanillaVersion })
                          try {
                            const res = await api.launchVanilla(vanillaVersion)
                            if (res.ok) {
                              setLaunchVanillaJson(JSON.stringify(res, null, 2))
                              setLaunchVanillaError(null)
                              setLaunchVanillaCanRetry(true)
                              logger.info('launchVanilla success', { ok: true })
                            } else {
                              const msg = failureMessage(res, 'Launch failed.')
                              setLaunchVanillaError(msg)
                              setLaunchVanillaCanRetry(res.failure?.canRetry ?? true)
                              logger.info('launchVanilla failure', { ok: false })
                            }
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err)
                            setLaunchVanillaError(msg)
                            logger.info('launchVanilla threw', { error: msg })
                          } finally {
                            setIsLaunchingVanilla(false)
                          }
                        })()
                      }}
                      disabled={isLaunchingVanilla || launchBlocked || (!launchVanillaCanRetry && launchVanillaError !== null)}
                    >
                      {isLaunchingVanilla ? 'Launching…' : 'Launch Minecraft'}
                    </button>
                  </div>
                  <div className="launch-controls launch-controls-advanced">
                    <label className="launch-version-label">
                      <span>Minecraft version (managed automatically)</span>
                      <p className="launch-version-helper">
                        MineAnvil manages the Minecraft version for you. You don't need to change this unless asked by support.
                      </p>
                      <input
                        className="launch-version-input"
                        value={vanillaVersion}
                        onChange={(e) => setVanillaVersion(e.target.value)}
                        placeholder="latest or 1.21.4"
                      />
                    </label>
                    <div className="launch-actions-advanced">
                      <button
                        className="button-secondary button-small"
                        onClick={() => {
                          void (async () => {
                            setIsInstallingVanilla(true)
                            setInstallVanillaError(null)
                            setInstallVanillaCanRetry(true)
                            logger.info('installVanilla clicked', { version: vanillaVersion })
                            try {
                              const res = await api.installVanilla(vanillaVersion)
                              if (res.ok) {
                                setInstallVanillaJson(JSON.stringify(res, null, 2))
                                setInstallVanillaError(null)
                                setInstallVanillaCanRetry(true)
                                logger.info('installVanilla success', { ok: true })
                              } else {
                                const msg = failureMessage(res, 'Install failed.')
                                setInstallVanillaError(msg)
                                setInstallVanillaCanRetry(res.failure?.canRetry ?? true)
                                logger.info('installVanilla failure', { ok: false })
                              }
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : String(err)
                              setInstallVanillaError(msg)
                              logger.info('installVanilla threw', { error: msg })
                            } finally {
                              setIsInstallingVanilla(false)
                            }
                          })()
                        }}
                        disabled={isInstallingVanilla || launchBlocked || (!installVanillaCanRetry && installVanillaError !== null)}
                      >
                        {isInstallingVanilla ? 'Installing…' : 'Install version'}
                      </button>
                      <p className="launch-action-helper">
                        Use this only if Minecraft isn't ready or support asks you to.
                      </p>
                    </div>
                  </div>
                  {launchVanillaError ? (
                    <div className="status-error">
                      <p className="error-message">{launchVanillaError}</p>
                      {!launchVanillaCanRetry ? (
                        <p className="error-note">Retrying will not help. This is a permanent issue.</p>
                      ) : null}
                    </div>
                  ) : null}
                  {installVanillaError ? (
                    <div className="status-error">
                      <p className="error-message">{installVanillaError}</p>
                      {!installVanillaCanRetry ? (
                        <p className="error-note">Retrying will not help. This is a permanent issue.</p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>
        ) : null}
      </div>
      </div>
    )
  }

  const renderAccountContent = () => (
    <div className="main-content">
      <div className="content-header">
        <h1 className="content-title">Account</h1>
        <p className="content-subtitle">Manage your Microsoft account and Minecraft ownership</p>
      </div>

      <section className="status-card">
        <div className="status-card-header">
          <h2 className="status-card-title">Account Status</h2>
          <button
            className="button-secondary button-small"
            onClick={() => {
              logger.info('auth status refresh clicked')
              void fetchStatus('refresh')
            }}
            disabled={isFetchingStatus}
          >
            {isFetchingStatus ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {statusError ? (
          <div className="status-error">
            <p className="error-message">{statusError}</p>
          </div>
        ) : authStatus ? (
          authStatus.signedIn ? (
            <div className="status-content">
              <div className="status-indicator status-success">
                <span className="status-icon">✓</span>
                <span className="status-text">Signed in</span>
              </div>
              <div className="status-details">
                <p className="status-detail">
                  <span className="status-label">Name:</span>
                  <span className="status-value">{authStatus.displayName ?? 'Not available'}</span>
                </p>
                <p className="status-detail">
                  <span className="status-label">Minecraft:</span>
                  <span className="status-value">
                    {ownershipState === 'OWNED' ? 'Ready ✓' : ownershipState === 'NOT_OWNED' ? 'Not owned' : ownershipState === 'UNVERIFIED_APP_NOT_APPROVED' ? 'Verification pending' : 'Unknown'}
                  </span>
                </p>
              </div>
              <button
                className="button-primary"
                onClick={() => {
                  void (async () => {
                    setIsSigningOut(true)
                    setSignOutMessage(null)
                    logger.info('auth sign-out clicked')
                    try {
                      const res = await api.authSignOut()
                      if (res.ok) {
                        setSignOutMessage('Signed out.')
                        logger.info('auth sign-out result', { ok: true })
                        await fetchStatus('refresh')
                      } else {
                        setSignOutMessage(failureMessage(res, 'Sign-out failed.'))
                        logger.info('auth sign-out result', { ok: false })
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err)
                      setSignOutMessage(msg)
                      logger.info('auth sign-out threw', { error: msg })
                    } finally {
                      setIsSigningOut(false)
                    }
                  })()
                }}
                disabled={isSigningOut}
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
              {signOutMessage ? <p className="status-message">{signOutMessage}</p> : null}
            </div>
          ) : (
            <div className="status-content">
              <div className="status-indicator status-warning">
                <span className="status-icon">!</span>
                <span className="status-text">Not signed in</span>
              </div>
              <p className="status-description">Please sign in with your Microsoft account to continue.</p>
              <button
                className="button-primary"
                onClick={() => {
                  void (async () => {
                    setIsSigningIn(true)
                    setSignInMessage(null)
                    logger.info('auth sign-in clicked')
                    try {
                      const res = await api.authSignIn()
                      if (res.ok) {
                        setSignInMessage('Sign-in started/completed successfully.')
                        logger.info('auth sign-in result', { ok: true })
                        await fetchStatus('refresh')
                      } else {
                        setSignInMessage(failureMessage(res, 'Sign-in failed.'))
                        logger.info('auth sign-in result', { ok: false, error: res.error ?? '(no error provided)' })
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err)
                      setSignInMessage(msg)
                      logger.info('auth sign-in threw', { error: msg })
                    } finally {
                      setIsSigningIn(false)
                    }
                  })()
                }}
                disabled={isSigningIn}
              >
                {isSigningIn ? 'Signing in…' : 'Sign in with Microsoft'}
              </button>
              {signInMessage ? <p className="status-message">{signInMessage}</p> : null}
            </div>
          )
        ) : (
          <div className="status-content">
            <p className="status-loading">Loading account status…</p>
          </div>
        )}
      </section>
    </div>
  )

  const renderMinecraftContent = () => (
    <div className="main-content">
      <div className="content-header">
        <h1 className="content-title">Minecraft</h1>
        <p className="content-subtitle">Launch and manage Minecraft Java Edition</p>
      </div>

      {authStatus?.signedIn && ownershipState === 'OWNED' ? (
        <section className="status-card">
          <div className="status-card-header">
            <h2 className="status-card-title">Minecraft</h2>
          </div>
          <div className="status-content">
            {launchBlocked ? (
              <div className="status-error">
                <p className="error-message">
                  <strong>Cannot launch</strong> —{' '}
                  {!authStatus?.signedIn
                    ? 'please sign in to verify ownership.'
                    : ownershipState === 'NOT_OWNED'
                      ? 'this account does not own Minecraft: Java Edition.'
                      : ownershipState === 'UNVERIFIED_APP_NOT_APPROVED'
                        ? 'MineAnvil is not approved for Minecraft services yet, so ownership cannot be verified.'
                        : 'ownership could not be verified yet (try again later).'}
                </p>
              </div>
            ) : (
              <>
                <p className="status-description">Minecraft is ready to play.</p>
                <div className="launch-controls launch-controls-advanced">
                  <label className="launch-version-label">
                    <span>Minecraft version:</span>
                    <input
                      className="launch-version-input"
                      value={vanillaVersion}
                      onChange={(e) => setVanillaVersion(e.target.value)}
                      placeholder="latest or 1.21.4"
                    />
                  </label>
                </div>
                <div className="launch-actions">
                  <button
                    className="button-primary button-large"
                    onClick={() => {
                      void (async () => {
                        setIsLaunchingVanilla(true)
                        setLaunchVanillaError(null)
                        setLaunchVanillaCanRetry(true)
                        logger.info('launchVanilla clicked', { version: vanillaVersion })
                        try {
                          const res = await api.launchVanilla(vanillaVersion)
                          if (res.ok) {
                            setLaunchVanillaJson(JSON.stringify(res, null, 2))
                            setLaunchVanillaError(null)
                            setLaunchVanillaCanRetry(true)
                            logger.info('launchVanilla success', { ok: true })
                          } else {
                            const msg = failureMessage(res, 'Launch failed.')
                            setLaunchVanillaError(msg)
                            setLaunchVanillaCanRetry(res.failure?.canRetry ?? true)
                            logger.info('launchVanilla failure', { ok: false })
                          }
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : String(err)
                          setLaunchVanillaError(msg)
                          logger.info('launchVanilla threw', { error: msg })
                        } finally {
                          setIsLaunchingVanilla(false)
                        }
                      })()
                    }}
                    disabled={isLaunchingVanilla || launchBlocked || (!launchVanillaCanRetry && launchVanillaError !== null)}
                  >
                    {isLaunchingVanilla ? 'Launching…' : 'Launch Minecraft'}
                  </button>
                  <button
                    className="button-secondary button-small button-deemphasized"
                    onClick={() => {
                      void (async () => {
                        setIsInstallingVanilla(true)
                        setInstallVanillaError(null)
                        setInstallVanillaCanRetry(true)
                        logger.info('installVanilla clicked', { version: vanillaVersion })
                        try {
                          const res = await api.installVanilla(vanillaVersion)
                          if (res.ok) {
                            setInstallVanillaJson(JSON.stringify(res, null, 2))
                            setInstallVanillaError(null)
                            setInstallVanillaCanRetry(true)
                            logger.info('installVanilla success', { ok: true })
                          } else {
                            const msg = failureMessage(res, 'Install failed.')
                            setInstallVanillaError(msg)
                            setInstallVanillaCanRetry(res.failure?.canRetry ?? true)
                            logger.info('installVanilla failure', { ok: false })
                          }
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : String(err)
                          setInstallVanillaError(msg)
                          logger.info('installVanilla threw', { error: msg })
                        } finally {
                          setIsInstallingVanilla(false)
                        }
                      })()
                    }}
                    disabled={isInstallingVanilla || launchBlocked || (!installVanillaCanRetry && installVanillaError !== null)}
                  >
                    {isInstallingVanilla ? 'Installing…' : 'Install version'}
                  </button>
                </div>
                {launchVanillaError ? (
                  <div className="status-error">
                    <p className="error-message">{launchVanillaError}</p>
                    {!launchVanillaCanRetry ? (
                      <p className="error-note">Retrying will not help. This is a permanent issue.</p>
                    ) : null}
                  </div>
                ) : null}
                {installVanillaError ? (
                  <div className="status-error">
                    <p className="error-message">{installVanillaError}</p>
                    {!installVanillaCanRetry ? (
                      <p className="error-note">Retrying will not help. This is a permanent issue.</p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="status-card">
          <div className="status-content">
            <div className="status-indicator status-warning">
              <span className="status-icon">!</span>
              <span className="status-text">Sign in required</span>
            </div>
            <p className="status-description">Please sign in with your Microsoft account and verify Minecraft ownership to launch the game.</p>
            <button
              className="button-primary"
              onClick={() => {
                setCurrentSection('account')
                logger.info('navigate to account from minecraft')
              }}
            >
              Go to Account
            </button>
          </div>
        </section>
      )}
    </div>
  )

  const renderDiagnosticsContent = () => (
    <div className="main-content">
      <div className="content-header">
        <h1 className="content-title">Diagnostics</h1>
        <p className="content-subtitle">Technical information used for troubleshooting. Most parents will never need this page.</p>
      </div>

      <section className="status-card">
        <div className="diagnostics-actions">
          <button
            className="button-secondary"
            onClick={() => {
              const bundle = buildDiagnosticsBundle()
              logger.info('diagnostics export clicked', { ts: bundle.app.timestamp })
              downloadDiagnosticsJson(bundle)
            }}
          >
            Download diagnostics file
          </button>
          <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>
            This file contains technical information about your MineAnvil installation. You only need to download it if someone asks for it (e.g., for troubleshooting support).
          </p>
        </div>

        <div className="diagnostics-section-inner">
          {authStatus?.signedIn ? (
            <div className="diagnostics-group">
              <h4 className="diagnostics-group-title">Account Information</h4>
              <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>
                These details identify your account. They are shown here for troubleshooting purposes only.
              </p>
              <div className="diagnostics-data">
                <p><strong>Display name:</strong> {authStatus.displayName ?? '(unknown)'}</p>
                <p><strong>UUID:</strong> {authStatus.uuid ?? '(unknown)'}</p>
                {typeof authStatus.expiresAt === 'number' ? <p><strong>Expires at:</strong> {authStatus.expiresAt}</p> : null}
                <p><strong>Ownership state:</strong> {authStatus.ownershipState}</p>
              </div>
            </div>
          ) : null}

          <div className="diagnostics-group">
            <h4 className="diagnostics-group-title">Java Runtime</h4>
            <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>
              Minecraft requires Java to run. MineAnvil manages this automatically for you. These buttons are only needed if Minecraft fails to start.
            </p>
            <div className="diagnostics-actions-inline">
              <button
                className="button-secondary button-small"
                onClick={() => {
                  void (async () => {
                    setIsCheckingRuntime(true)
                    setRuntimeStatusError(null)
                    setRuntimeStatusCanRetry(true)
                    logger.info('getRuntimeStatus clicked')
                    try {
                      const res = await api.getRuntimeStatus()
                      if (res.ok) {
                        setRuntimeStatusJson(JSON.stringify(res, null, 2))
                        setRuntimeStatusError(null)
                        setRuntimeStatusCanRetry(true)
                        logger.info('getRuntimeStatus success', { installed: res.installed })
                      } else {
                        const msg = failureMessage(res, 'Failed to get runtime status.')
                        setRuntimeStatusError(msg)
                        setRuntimeStatusCanRetry(res.failure?.canRetry ?? true)
                        logger.info('getRuntimeStatus failure', { ok: false })
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err)
                      setRuntimeStatusError(msg)
                      logger.info('getRuntimeStatus threw', { error: msg })
                    } finally {
                      setIsCheckingRuntime(false)
                    }
                  })()
                }}
                disabled={isCheckingRuntime}
              >
                {isCheckingRuntime ? 'Checking…' : 'Check runtime status'}
              </button>
              <button
                className="button-secondary button-small"
                onClick={() => {
                  void (async () => {
                    setIsEnsuringRuntime(true)
                    setEnsureRuntimeError(null)
                    setEnsureRuntimeCanRetry(true)
                    logger.info('ensureRuntime clicked')
                    try {
                      const res = await api.ensureRuntime()
                      if (res.ok && res.runtime) {
                        setEnsureRuntimeJson(JSON.stringify(res, null, 2))
                        setEnsureRuntimeError(null)
                        setEnsureRuntimeCanRetry(true)
                        logger.info('ensureRuntime success', { kind: res.runtime.kind })
                      } else {
                        const msg = failureMessage(res, 'Failed to ensure runtime.')
                        setEnsureRuntimeError(msg)
                        setEnsureRuntimeCanRetry(res.failure?.canRetry ?? true)
                        logger.info('ensureRuntime failure', { ok: false })
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err)
                      setEnsureRuntimeError(msg)
                      logger.info('ensureRuntime threw', { error: msg })
                    } finally {
                      setIsEnsuringRuntime(false)
                    }
                  })()
                }}
                disabled={isEnsuringRuntime || (!ensureRuntimeCanRetry && ensureRuntimeError !== null)}
              >
                {isEnsuringRuntime ? 'Installing…' : 'Install runtime (Windows)'}
              </button>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', lineHeight: '1.4' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem' }}>Check runtime status — See if Java is installed and working</span>
              <span style={{ display: 'block' }}>Install runtime (Windows) — Download and install Java if needed</span>
            </p>
            {runtimeStatusError ? (
              <div className="status-error">
                <p className="error-message">{runtimeStatusError}</p>
                {!runtimeStatusCanRetry ? (
                  <p className="error-note">Retrying will not help. This is a permanent issue.</p>
                ) : null}
              </div>
            ) : null}
            {runtimeStatusJson ? (
              <pre className="diagnostics-json">{runtimeStatusJson}</pre>
            ) : null}
            {ensureRuntimeError ? (
              <div className="status-error">
                <p className="error-message">{ensureRuntimeError}</p>
                {!ensureRuntimeCanRetry ? (
                  <p className="error-note">Retrying will not help. This is a permanent issue.</p>
                ) : null}
              </div>
            ) : null}
            {ensureRuntimeJson ? (
              <pre className="diagnostics-json">{ensureRuntimeJson}</pre>
            ) : null}
          </div>

          <div className="diagnostics-group">
            <h4 className="diagnostics-group-title">Minecraft Installation</h4>
            <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>
              These tools are for advanced troubleshooting. They show how MineAnvil starts Minecraft internally. You do not need to use these unless asked by support.
            </p>
            <div className="diagnostics-actions-inline">
              <button
                className="button-secondary button-small"
                onClick={() => {
                  void (async () => {
                    setIsLoadingLaunchCmd(true)
                    setLaunchCmdError(null)
                    setLaunchCmdCanRetry(true)
                    logger.info('getLaunchCommand clicked', { version: vanillaVersion })
                    try {
                      const res = await api.getLaunchCommand(vanillaVersion)
                      if (res.ok && res.command) {
                        setLaunchCmdJson(JSON.stringify(res.command, null, 2))
                        setLaunchCmdError(null)
                        setLaunchCmdCanRetry(true)
                        logger.info('getLaunchCommand success', { ok: true })
                      } else {
                        const msg = failureMessage(res, 'Failed to get launch command.')
                        setLaunchCmdError(msg)
                        setLaunchCmdCanRetry(res.failure?.canRetry ?? true)
                        logger.info('getLaunchCommand failure', { ok: false })
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err)
                      setLaunchCmdError(msg)
                      logger.info('getLaunchCommand threw', { error: msg })
                    } finally {
                      setIsLoadingLaunchCmd(false)
                    }
                  })()
                }}
                disabled={isLoadingLaunchCmd || launchBlocked || (!launchCmdCanRetry && launchCmdError !== null)}
              >
                {isLoadingLaunchCmd ? 'Loading…' : 'Show launch command'}
              </button>
              <button
                className="button-secondary button-small"
                onClick={() => {
                  void (async () => {
                    setIsLoadingLaunchPlan(true)
                    setLaunchPlanError(null)
                    setLaunchPlanCanRetry(true)
                    logger.info('getLaunchPlan clicked')
                    try {
                      const res = await api.getLaunchPlan()
                      if (res.ok && res.plan) {
                        setLaunchPlanJson(JSON.stringify(res.plan, null, 2))
                        setLaunchPlanError(null)
                        setLaunchPlanCanRetry(true)
                        logger.info('getLaunchPlan success', { ok: true })
                      } else {
                        const msg = failureMessage(res, 'Failed to get launch plan.')
                        setLaunchPlanError(msg)
                        setLaunchPlanCanRetry(res.failure?.canRetry ?? true)
                        logger.info('getLaunchPlan failure', { ok: false })
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err)
                      setLaunchPlanError(msg)
                      logger.info('getLaunchPlan threw', { error: msg })
                    } finally {
                      setIsLoadingLaunchPlan(false)
                    }
                  })()
                }}
                disabled={isLoadingLaunchPlan || (!launchPlanCanRetry && launchPlanError !== null)}
              >
                {isLoadingLaunchPlan ? 'Loading…' : 'Show launch plan (dry-run)'}
              </button>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', lineHeight: '1.4' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem' }}>Show launch command — See the exact command used to start Minecraft</span>
              <span style={{ display: 'block' }}>Show launch plan (dry-run) — Preview how MineAnvil will start Minecraft without actually launching it</span>
            </p>
            {launchCmdError ? (
              <div className="status-error">
                <p className="error-message">{launchCmdError}</p>
                {!launchCmdCanRetry ? (
                  <p className="error-note">Retrying will not help. This is a permanent issue.</p>
                ) : null}
              </div>
            ) : null}
            {launchCmdJson ? (
              <pre className="diagnostics-json">{launchCmdJson}</pre>
            ) : null}
            {launchPlanError ? (
              <div className="status-error">
                <p className="error-message">{launchPlanError}</p>
                {!launchPlanCanRetry ? (
                  <p className="error-note">Retrying will not help. This is a permanent issue.</p>
                ) : null}
              </div>
            ) : null}
            {launchPlanJson ? (
              <pre className="diagnostics-json">{launchPlanJson}</pre>
            ) : null}
            {installVanillaJson ? (
              <div className="diagnostics-group">
                <h4 className="diagnostics-group-title">Install Result</h4>
                <pre className="diagnostics-json">{installVanillaJson}</pre>
              </div>
            ) : null}
            {launchVanillaJson ? (
              <div className="diagnostics-group">
                <h4 className="diagnostics-group-title">Launch Result</h4>
                <pre className="diagnostics-json">{launchVanillaJson}</pre>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )

  const renderRightPanel = () => {
    if (!showRightPanel) return null

    return (
      <div className="right-panel">
        <div className="right-panel-header">
          <h3 className="right-panel-title">Details</h3>
          <button
            className="button-link button-small"
            onClick={() => setShowRightPanel(false)}
          >
            ✕
          </button>
        </div>
        <div className="right-panel-content">
          {authStatus?.signedIn ? (
            <div className="details-section">
              <h4 className="details-section-title">Account Details</h4>
              <div className="details-data">
                <p><strong>Display name:</strong> {authStatus.displayName ?? '(unknown)'}</p>
                <p><strong>UUID:</strong> {authStatus.uuid ?? '(unknown)'}</p>
                {typeof authStatus.expiresAt === 'number' ? <p><strong>Expires at:</strong> {authStatus.expiresAt}</p> : null}
                <p><strong>Ownership state:</strong> {authStatus.ownershipState}</p>
              </div>
            </div>
          ) : null}

          <div className="details-section">
            <h4 className="details-section-title">Minecraft Version</h4>
            <div className="details-data">
              <p>Current selection: <strong>{vanillaVersion}</strong></p>
            </div>
          </div>

          <div className="details-section">
            <h4 className="details-section-title">Advanced</h4>
            <button
              className="button-secondary button-small"
              onClick={() => {
                setCurrentSection('diagnostics')
                setShowRightPanel(false)
                logger.info('navigate to diagnostics from right panel')
              }}
            >
              Open Diagnostics
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Left Navigation */}
      <nav className="left-nav">
        <div className="nav-header">
          <img src="/logo.png" alt="MineAnvil" className="nav-logo" />
          <h1 className="nav-title">MineAnvil</h1>
        </div>
        <div className="nav-items">
          <button
            className={`nav-item ${currentSection === 'home' ? 'nav-item-active' : ''}`}
            onClick={() => {
              setCurrentSection('home')
              logger.info('nav: home clicked')
            }}
          >
            Home
          </button>
          <button
            className={`nav-item ${currentSection === 'account' ? 'nav-item-active' : ''}`}
            onClick={() => {
              setCurrentSection('account')
              logger.info('nav: account clicked')
            }}
          >
            Account
          </button>
          <button
            className={`nav-item ${currentSection === 'minecraft' ? 'nav-item-active' : ''}`}
            onClick={() => {
              setCurrentSection('minecraft')
              logger.info('nav: minecraft clicked')
            }}
          >
            Minecraft
          </button>
          <button
            className={`nav-item ${currentSection === 'diagnostics' ? 'nav-item-active' : ''}`}
            onClick={() => {
              setCurrentSection('diagnostics')
              logger.info('nav: diagnostics clicked')
            }}
          >
            Diagnostics
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="main-area">
        {currentSection === 'home' && renderHomeContent()}
        {currentSection === 'account' && renderAccountContent()}
        {currentSection === 'minecraft' && renderMinecraftContent()}
        {currentSection === 'diagnostics' && renderDiagnosticsContent()}

        {/* Right Panel Toggle */}
        <button
          className="right-panel-toggle"
          onClick={() => {
            setShowRightPanel(!showRightPanel)
            logger.info('right panel toggle', { show: !showRightPanel })
          }}
          title={showRightPanel ? 'Hide details' : 'Show details'}
        >
          {showRightPanel ? '◀' : '▶'}
        </button>
      </div>

      {/* Right Panel */}
      {renderRightPanel()}

      {/* Dev Tools (Browser Mode Only) */}
      {isBrowserMode ? (
        <div className="dev-tools-fixed">
          <details>
            <summary className="dev-tools-summary">Developer Tools (browser mode)</summary>
            <div className="dev-tools-content">
              <div className="diagnostics-actions-inline">
                <button
                  className="button-secondary button-small"
                  onClick={() => {
                    const anyApi = api as MineAnvilApi & {
                      __dev?: { setAuthStatus: (status: AuthStatus) => void }
                    }
                    anyApi.__dev?.setAuthStatus({
                      signedIn: true,
                      ownershipState: 'OWNED',
                      minecraftOwned: true,
                      displayName: 'Dev Player',
                      uuid: '00000000-0000-0000-0000-000000000000',
                    })
                    logger.info('dev tool: simulate signed in')
                  }}
                >
                  Simulate signed in
                </button>
                <button
                  className="button-secondary button-small"
                  onClick={() => {
                    const anyApi = api as MineAnvilApi & {
                      __dev?: { setAuthStatus: (status: AuthStatus) => void }
                    }
                    anyApi.__dev?.setAuthStatus({ signedIn: false })
                    logger.info('dev tool: simulate signed out')
                  }}
                >
                  Simulate signed out
                </button>
              </div>
              <p className="dev-tools-note">
                These tools only affect the browser stub. Click <strong>Refresh</strong> to re-fetch via the normal API.
              </p>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  )
}

export default App
