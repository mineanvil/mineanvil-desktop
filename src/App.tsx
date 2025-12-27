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
                        logger.info('auth sign-in result', { ok: false })
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

        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
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
                  logInfo('dev tool: simulate signed in')
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
                  logInfo('dev tool: simulate signed out')
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
