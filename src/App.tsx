import { useCallback, useEffect, useMemo, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { getMineAnvilApi } from './bridge/mineanvil'
import type { AuthStatus, MineAnvilApi } from '../electron/src/shared/ipc-types'

function App() {
  const [count, setCount] = useState(0)
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isFetchingStatus, setIsFetchingStatus] = useState<boolean>(false)

  const api = useMemo(() => getMineAnvilApi(), [])

  const logInfo = useCallback((message: string, meta?: Record<string, unknown>) => {
    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        area: 'renderer',
        message,
        meta,
      }),
    )
  }, [])

  const fetchStatus = useCallback(
    async (reason: 'initial' | 'refresh') => {
      setIsFetchingStatus(true)
      setStatusError(null)
      try {
        const status = await api.authGetStatus()
        setAuthStatus(status)
        logInfo('auth status fetched', { reason, signedIn: status.signedIn })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setStatusError(msg)
        logInfo('auth status fetch failed', { reason, error: msg })
      } finally {
        setIsFetchingStatus(false)
      }
    },
    [api, logInfo],
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={() => {
              logInfo('auth status refresh clicked')
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
            </div>
          )
        ) : (
          <p>Loading status…</p>
        )}

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
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
