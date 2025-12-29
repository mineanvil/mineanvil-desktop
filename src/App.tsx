import { useCallback, useEffect, useMemo, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { getMineAnvilApi } from './bridge/mineanvil'
import type { AuthStatus, MineAnvilApi } from '../electron/src/shared/ipc-types'
import { buildDiagnosticsBundle, downloadDiagnosticsJson } from './diagnostics/export'
import { getRendererLogger } from './logging/renderer'

function App() {
  const [count, setCount] = useState(0)
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isFetchingStatus, setIsFetchingStatus] = useState<boolean>(false)
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false)
  const [signInMessage, setSignInMessage] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false)
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null)
  const [launchPlanJson, setLaunchPlanJson] = useState<string | null>(null)
  const [launchPlanError, setLaunchPlanError] = useState<string | null>(null)
  const [isLoadingLaunchPlan, setIsLoadingLaunchPlan] = useState<boolean>(false)
  const [runtimeStatusJson, setRuntimeStatusJson] = useState<string | null>(null)
  const [runtimeStatusError, setRuntimeStatusError] = useState<string | null>(null)
  const [isCheckingRuntime, setIsCheckingRuntime] = useState<boolean>(false)
  const [ensureRuntimeJson, setEnsureRuntimeJson] = useState<string | null>(null)
  const [ensureRuntimeError, setEnsureRuntimeError] = useState<string | null>(null)
  const [isEnsuringRuntime, setIsEnsuringRuntime] = useState<boolean>(false)
  const [vanillaVersion, setVanillaVersion] = useState<string>('latest')
  const [installVanillaJson, setInstallVanillaJson] = useState<string | null>(null)
  const [installVanillaError, setInstallVanillaError] = useState<string | null>(null)
  const [isInstallingVanilla, setIsInstallingVanilla] = useState<boolean>(false)
  const [launchCmdJson, setLaunchCmdJson] = useState<string | null>(null)
  const [launchCmdError, setLaunchCmdError] = useState<string | null>(null)
  const [isLoadingLaunchCmd, setIsLoadingLaunchCmd] = useState<boolean>(false)
  const [launchVanillaJson, setLaunchVanillaJson] = useState<string | null>(null)
  const [launchVanillaError, setLaunchVanillaError] = useState<string | null>(null)
  const [isLaunchingVanilla, setIsLaunchingVanilla] = useState<boolean>(false)
  const [tab, setTab] = useState<'home' | 'diagnostics'>('home')

  const api = useMemo(() => getMineAnvilApi(), [])
  const logger = useMemo(() => getRendererLogger('ui'), [])

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
  const launchBlocked = !authStatus?.signedIn || authStatus.minecraftOwned !== true

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          <button onClick={() => setTab('home')} disabled={tab === 'home'}>
            Home
          </button>
          <button onClick={() => setTab('diagnostics')} disabled={tab === 'diagnostics'}>
            Diagnostics
          </button>
        </div>

        {tab === 'diagnostics' ? (
          <div>
            <p>Export a diagnostics bundle for support.</p>
            <button
              onClick={() => {
                const bundle = buildDiagnosticsBundle()
                logger.info('diagnostics export clicked', { ts: bundle.app.timestamp })
                downloadDiagnosticsJson(bundle)
              }}
            >
              Download diagnostics.json
            </button>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    void (async () => {
                      setIsCheckingRuntime(true)
                      setRuntimeStatusError(null)
                      logger.info('getRuntimeStatus clicked')
                      try {
                        const res = await api.getRuntimeStatus()
                        if (res.ok) {
                          setRuntimeStatusJson(JSON.stringify(res, null, 2))
                          logger.info('getRuntimeStatus success', { installed: res.installed })
                        } else {
                          const msg = res.error ?? 'Failed to get runtime status.'
                          setRuntimeStatusError(msg)
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
                  onClick={() => {
                    void (async () => {
                      setIsEnsuringRuntime(true)
                      setEnsureRuntimeError(null)
                      logger.info('ensureRuntime clicked')
                      try {
                        const res = await api.ensureRuntime()
                        if (res.ok && res.runtime) {
                          setEnsureRuntimeJson(JSON.stringify(res, null, 2))
                          logger.info('ensureRuntime success', { kind: res.runtime.kind })
                        } else {
                          const msg = res.error ?? 'Failed to ensure runtime.'
                          setEnsureRuntimeError(msg)
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
                  disabled={isEnsuringRuntime}
                >
                  {isEnsuringRuntime ? 'Installing…' : 'Install runtime (Windows)'}
                </button>
              </div>

              {runtimeStatusError ? <p style={{ color: 'crimson' }}>{runtimeStatusError}</p> : null}
              {runtimeStatusJson ? (
                <pre style={{ marginTop: 12, textAlign: 'left', maxHeight: 180, overflow: 'auto' }}>{runtimeStatusJson}</pre>
              ) : null}

              {ensureRuntimeError ? <p style={{ color: 'crimson' }}>{ensureRuntimeError}</p> : null}
              {ensureRuntimeJson ? (
                <pre style={{ marginTop: 12, textAlign: 'left', maxHeight: 180, overflow: 'auto' }}>{ensureRuntimeJson}</pre>
              ) : null}

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                <p>Vanilla Minecraft (Windows runner)</p>
                {launchBlocked ? (
                  <p style={{ color: 'crimson' }}>
                    <strong>Launch blocked</strong> — sign in with an account that owns Minecraft: Java Edition (ownership must
                    be verified).
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label>
                    Version:{' '}
                    <input
                      value={vanillaVersion}
                      onChange={(e) => setVanillaVersion(e.target.value)}
                      style={{ width: 140 }}
                      placeholder="latest or 1.21.4"
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <button
                    onClick={() => {
                      void (async () => {
                        setIsInstallingVanilla(true)
                        setInstallVanillaError(null)
                        logger.info('installVanilla clicked', { version: vanillaVersion })
                        try {
                          const res = await api.installVanilla(vanillaVersion)
                          if (res.ok) {
                            setInstallVanillaJson(JSON.stringify(res, null, 2))
                            logger.info('installVanilla success', { ok: true })
                          } else {
                            const msg = res.error ?? 'Install failed.'
                            setInstallVanillaError(msg)
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
                    disabled={isInstallingVanilla || launchBlocked}
                  >
                    {isInstallingVanilla ? 'Installing…' : 'Install Vanilla (Windows)'}
                  </button>
                  <button
                    onClick={() => {
                      void (async () => {
                        setIsLoadingLaunchCmd(true)
                        setLaunchCmdError(null)
                        logger.info('getLaunchCommand clicked', { version: vanillaVersion })
                        try {
                          const res = await api.getLaunchCommand(vanillaVersion)
                          if (res.ok && res.command) {
                            setLaunchCmdJson(JSON.stringify(res.command, null, 2))
                            logger.info('getLaunchCommand success', { ok: true })
                          } else {
                            const msg = res.error ?? 'Failed to get launch command.'
                            setLaunchCmdError(msg)
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
                    disabled={isLoadingLaunchCmd || launchBlocked}
                  >
                    {isLoadingLaunchCmd ? 'Loading…' : 'Show Launch Command'}
                  </button>
                  <button
                    onClick={() => {
                      void (async () => {
                        setIsLaunchingVanilla(true)
                        setLaunchVanillaError(null)
                        logger.info('launchVanilla clicked', { version: vanillaVersion })
                        try {
                          const res = await api.launchVanilla(vanillaVersion)
                          if (res.ok) {
                            setLaunchVanillaJson(JSON.stringify(res, null, 2))
                            logger.info('launchVanilla success', { ok: true })
                          } else {
                            const msg = res.error ?? 'Launch failed.'
                            setLaunchVanillaError(msg)
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
                    disabled={isLaunchingVanilla || launchBlocked}
                  >
                    {isLaunchingVanilla ? 'Launching…' : 'Launch Vanilla (Windows)'}
                  </button>
                </div>

                {installVanillaError ? <p style={{ color: 'crimson' }}>{installVanillaError}</p> : null}
                {installVanillaJson ? (
                  <pre style={{ marginTop: 12, textAlign: 'left', maxHeight: 180, overflow: 'auto' }}>{installVanillaJson}</pre>
                ) : null}

                {launchCmdError ? <p style={{ color: 'crimson' }}>{launchCmdError}</p> : null}
                {launchCmdJson ? (
                  <pre style={{ marginTop: 12, textAlign: 'left', maxHeight: 180, overflow: 'auto' }}>{launchCmdJson}</pre>
                ) : null}

                {launchVanillaError ? <p style={{ color: 'crimson' }}>{launchVanillaError}</p> : null}
                {launchVanillaJson ? (
                  <pre style={{ marginTop: 12, textAlign: 'left', maxHeight: 180, overflow: 'auto' }}>{launchVanillaJson}</pre>
                ) : null}
              </div>

              <button
                onClick={() => {
                  void (async () => {
                    setIsLoadingLaunchPlan(true)
                    setLaunchPlanError(null)
                    logger.info('getLaunchPlan clicked')
                    try {
                      const res = await api.getLaunchPlan()
                      if (res.ok && res.plan) {
                        setLaunchPlanJson(JSON.stringify(res.plan, null, 2))
                        logger.info('getLaunchPlan success', { ok: true })
                      } else {
                        const msg = res.error ?? 'Failed to get launch plan.'
                        setLaunchPlanError(msg)
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
                disabled={isLoadingLaunchPlan}
              >
                {isLoadingLaunchPlan ? 'Loading…' : 'Show launch plan (dry-run)'}
              </button>
              {launchPlanError ? <p style={{ color: 'crimson' }}>{launchPlanError}</p> : null}
              {launchPlanJson ? (
                <pre style={{ marginTop: 12, textAlign: 'left', maxHeight: 280, overflow: 'auto' }}>{launchPlanJson}</pre>
              ) : null}
            </div>
          </div>
        ) : (
          <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={() => {
              logger.info('auth status refresh clicked')
              void fetchStatus('refresh')
            }}
            disabled={isFetchingStatus}
          >
            Refresh status
          </button>
          {isFetchingStatus ? <span>Refreshing…</span> : null}
        </div>

        {statusError ? (
          <p style={{ color: 'crimson' }}>Status error: {statusError}</p>
        ) : authStatus ? (
          authStatus.signedIn ? (
            <div>
              <p>
                <strong>Signed in</strong> — Ready
              </p>
              <p>Display name: {authStatus.displayName ?? '(unknown)'}</p>
              <p>UUID: {authStatus.uuid ?? '(unknown)'}</p>
              {typeof authStatus.expiresAt === 'number' ? <p>Expires at: {authStatus.expiresAt}</p> : null}
              {authStatus.minecraftOwned === true ? (
                <p>
                  <strong>Minecraft owned</strong>
                </p>
              ) : authStatus.minecraftOwned === false ? (
                <p>
                  <strong>Minecraft not owned (or not detected yet)</strong> — check on Windows runner later
                </p>
              ) : (
                <p>Minecraft ownership: (unknown)</p>
              )}
              <button
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
                        setSignOutMessage(res.error ?? 'Sign-out failed.')
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
            </div>
          ) : (
            <div>
              <p>
                <strong>Signed out</strong>
              </p>
              <p>Please sign in to continue.</p>
              <button
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
                        setSignInMessage(res.error ?? 'Sign-in failed.')
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
                {isSigningIn ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          )
        ) : (
          <p>Loading status…</p>
        )}

        {signInMessage ? <p style={{ marginTop: 12 }}>Sign-in: {signInMessage}</p> : null}
        {signOutMessage ? <p style={{ marginTop: 12 }}>Sign-out: {signOutMessage}</p> : null}

        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>

        <button
          onClick={() => {
            setTab('diagnostics')
            logger.info('show launch plan (home) clicked')
          }}
          style={{ marginTop: 12 }}
        >
          Show launch plan (dry-run)
        </button>

        {isBrowserMode ? (
          <details style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <summary style={{ cursor: 'pointer' }}>Dev tools (browser mode)</summary>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const anyApi = api as MineAnvilApi & {
                    __dev?: { setAuthStatus: (status: AuthStatus) => void }
                  }
                  anyApi.__dev?.setAuthStatus({
                    signedIn: true,
                    displayName: 'Dev Player',
                    uuid: '00000000-0000-0000-0000-000000000000',
                  })
                  logger.info('dev tool: simulate signed in')
                }}
              >
                Simulate signed in
              </button>
              <button
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
            <div style={{ marginTop: 12 }}>
              <small>
                These tools only affect the browser stub. Click <strong>Refresh status</strong> to re-fetch via the
                normal API.
              </small>
            </div>
          </details>
        ) : null}
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
          </>
        )}
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
