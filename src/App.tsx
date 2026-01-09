import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import './App.css'
import { getMineAnvilApi } from './bridge/mineanvil'
import type { AuthStatus, MineAnvilApi } from '../electron/src/shared/ipc-types'
import { buildDiagnosticsBundle, downloadDiagnosticsJson } from './diagnostics/export'
import { getRendererLogger } from './logging/renderer'
import { initialUxFlowState, uxFlowReducer } from './ux/flowReducer'
import { WelcomeScreen } from './screens/setup/WelcomeScreen'
import { MicrosoftSignInScreen } from './screens/setup/MicrosoftSignInScreen'
import { LicenseResolutionScreen, type LicenseResolutionOutcome } from './screens/setup/LicenseResolutionScreen'
import { MinecraftSetupScreen } from './screens/setup/MinecraftSetupScreen'
import { SetupErrorScreen } from './screens/setup/SetupErrorScreen'
import { AppShell } from './screens/app/AppShell'
import { HomeTab } from './screens/app/tabs/HomeTab'
import { WorldsTab } from './screens/app/tabs/WorldsTab'
import { CuratedWorldsTab } from './screens/app/tabs/CuratedWorldsTab'
import { SeedsTab } from './screens/app/tabs/SeedsTab'
import { ModsTab } from './screens/app/tabs/ModsTab'

const GAME_ID = 'minecraft' as const

function failureMessage(res: { error?: string; failure?: { userMessage: string } }, fallback: string): string {
    return res.failure?.userMessage ?? res.error ?? fallback
}

function usernameFromAuthStatus(status: AuthStatus): string | undefined {
  if (!status.signedIn) return undefined
  return status.displayName
}

function purchaseUrl(): string {
  return 'https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc'
}

export default function App() {
  const api = useMemo(() => getMineAnvilApi(), [])
  const logger = useMemo(() => getRendererLogger('ui'), [])

  const [flow, dispatch] = useReducer(uxFlowReducer, initialUxFlowState)

  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | undefined>(undefined)

  const [licenseOutcome, setLicenseOutcome] = useState<LicenseResolutionOutcome>('checking')
  const [licenseError, setLicenseError] = useState<string | undefined>(undefined)
  const [isCheckingLicense, setIsCheckingLicense] = useState(false)

  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | undefined>(undefined)

  const applyAuthStatus = useCallback(
    (status: AuthStatus) => {
      const username = usernameFromAuthStatus(status)
      if (!status.signedIn) {
        dispatch({ type: 'GO_TO_SETUP_WELCOME' })
        return
      }

      dispatch({ type: 'SET_USERNAME', username })

      if (status.ownershipState === 'OWNED') {
        dispatch({ type: 'SET_LICENSE_MODE', licenseMode: 'full' })
      }
    },
    [dispatch],
  )

  const refreshStatus = useCallback(
    async (reason: 'bootstrap' | 'refresh') => {
      try {
        const status = await api.authGetStatus()
        applyAuthStatus(status)
        logger.info('auth status fetched', { reason, signedIn: status.signedIn })
        return status
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : String(err)
        logger.info('auth status fetch failed', { reason, error: msg })
        return null
      }
    },
    [api, applyAuthStatus, logger],
  )

  // Bootstrap: if the user is already fully ready, go straight to Phase B.
  useEffect(() => {
    void (async () => {
      const status = await refreshStatus('bootstrap')
      if (!status) return

      if (!status.signedIn) return

      // If license is owned, assume setup was already completed previously and enter Phase B.
      if (status.ownershipState === 'OWNED') {
        dispatch({ type: 'BOOTSTRAP_APP_READY', username: usernameFromAuthStatus(status), licenseMode: 'full' })
        return
      }
    })()
  }, [refreshStatus])

  const onGetStarted = useCallback(() => {
                    void (async () => {
      try {
        const status = await api.authGetStatus()
        if (status.signedIn) {
          dispatch({ type: 'BOOTSTRAP_SETUP_LICENSE', username: usernameFromAuthStatus(status) })
                        } else {
          dispatch({ type: 'SETUP_GET_STARTED' })
        }
      } catch {
        dispatch({ type: 'SETUP_GET_STARTED' })
                      }
                    })()
  }, [api])

  const doSignIn = useCallback(async () => {
                      setIsSigningIn(true)
    setSignInError(undefined)
                      logger.info('auth sign-in clicked')
                      try {
                        const res = await api.authSignIn()
      if (!res.ok) {
        setSignInError(failureMessage(res, 'Sign-in failed.'))
                          logger.info('auth sign-in result', { ok: false, error: res.error ?? '(no error provided)' })
        return
      }
      const status = await refreshStatus('refresh')
      if (!status || !status.signedIn) {
        setSignInError('Sign-in did not complete. Please try again.')
        return
      }
      dispatch({ type: 'AUTH_SIGN_IN_SUCCESS', username: usernameFromAuthStatus(status) })
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err)
      setSignInError(msg)
                        logger.info('auth sign-in threw', { error: msg })
                      } finally {
                        setIsSigningIn(false)
                      }
  }, [api, logger, refreshStatus])

  const checkLicense = useCallback(async () => {
    setIsCheckingLicense(true)
    setLicenseError(undefined)
    setLicenseOutcome('checking')

    try {
      const res = await api.gameGetStatus(GAME_ID)
      if (!res.ok || !res.status) {
        setLicenseOutcome('notFound')
        dispatch({ type: 'LICENSE_NOT_FOUND' })
        if (!res.ok) setLicenseError(failureMessage(res, 'Could not check your Minecraft license.'))
        return
      }

      if (res.status.username) dispatch({ type: 'SET_USERNAME', username: res.status.username })

      if (res.status.readiness === 'ready') {
        setLicenseOutcome('verified')
        dispatch({ type: 'LICENSE_VERIFIED', username: res.status.username })
        return
      }

      setLicenseOutcome('notFound')
      dispatch({ type: 'LICENSE_NOT_FOUND', username: res.status.username })
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
      setLicenseError(msg)
      setLicenseOutcome('notFound')
                  } finally {
      setIsCheckingLicense(false)
    }
  }, [api])

  // When entering State 2 (License Resolution), run the check.
  useEffect(() => {
    if (flow.phase === 'setup' && flow.setupScreen === 'licenseResolution') {
      void checkLicense()
    }
  }, [flow.phase, flow.setupScreen, checkLicense])

  const launchMinecraft = useCallback(
    async (mode: 'default' | 'demo') => {
      setIsLaunching(true)
      setLaunchError(undefined)
      try {
        const res = await api.gameLaunch(GAME_ID, mode === 'demo' ? 'demo' : 'full')
        if (!res.ok) {
          setLaunchError(failureMessage(res, 'Could not start Minecraft.'))
          return
        }
        logger.info('gameLaunch success', { gameId: GAME_ID, mode })
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : String(err)
        setLaunchError(msg)
                        } finally {
        setIsLaunching(false)
      }
    },
    [api, logger],
  )

  const onViewDiagnostics = useCallback(() => {
              const bundle = buildDiagnosticsBundle()
              downloadDiagnosticsJson(bundle)
  }, [])

  const onAskForHelp = useCallback(() => {
    // TODO: Wire to a real support destination when available.
    window.open('mailto:?subject=MineAnvil%20help')
  }, [])

  if (flow.phase === 'setup') {
    switch (flow.setupScreen) {
      case 'welcome':
        return <WelcomeScreen onGetStarted={onGetStarted} />

      case 'microsoftSignIn':
        return <MicrosoftSignInScreen isSigningIn={isSigningIn} error={signInError} onSignIn={doSignIn} />

      case 'licenseResolution':
        return (
          <LicenseResolutionScreen
            outcome={licenseOutcome}
            isChecking={isCheckingLicense}
            error={licenseError}
            onOpenMinecraftWebsite={() => window.open(purchaseUrl())}
            onCheckAgain={() => void checkLicense()}
            onContinueDemo={() => {
              dispatch({ type: 'LICENSE_CONTINUE_DEMO' })
            }}
          />
        )

      case 'minecraftSetup':
    return (
          <MinecraftSetupScreen
            api={api as MineAnvilApi}
            licenseMode={flow.licenseMode}
            onSuccess={() => dispatch({ type: 'SETUP_PROGRESS_TO_APP' })}
            onFailure={(error) => dispatch({ type: 'SETUP_FAILURE', error })}
          />
        )

      case 'setupError':
        return (
          <SetupErrorScreen
            error={flow.error}
            onTryAgain={() => dispatch({ type: 'SETUP_TRY_AGAIN' })}
            onAskForHelp={onAskForHelp}
            onViewDiagnostics={onViewDiagnostics}
          />
        )
    }
  }

  return (
    <AppShell
      username={flow.username}
      licenseMode={flow.licenseMode}
      appTab={flow.appTab}
      onSelectTab={(tab) => dispatch({ type: 'APP_SELECT_TAB', tab })}
      onRefreshStatus={() => void refreshStatus('refresh')}
      onSignOut={() => {
        void (async () => {
          try {
            await api.authSignOut()
                  } finally {
            dispatch({ type: 'GO_TO_SETUP_WELCOME' })
          }
        })()
      }}
    >
      {flow.appTab === 'home' ? (
        <HomeTab
          isLaunching={isLaunching}
          error={launchError}
          onPlayMinecraft={() => void launchMinecraft(flow.licenseMode === 'demo' ? 'demo' : 'default')}
        />
      ) : flow.appTab === 'worlds' ? (
        <WorldsTab
          licenseMode={flow.licenseMode}
          onPlayDemo={() => void launchMinecraft('demo')}
          localWorlds={[]}
          remoteWorlds={[]}
        />
      ) : flow.appTab === 'curatedWorlds' ? (
        <CuratedWorldsTab />
      ) : flow.appTab === 'seeds' ? (
        <SeedsTab onReturnToWorlds={() => dispatch({ type: 'APP_SELECT_TAB', tab: 'worlds' })} />
      ) : (
        <ModsTab />
      )}
    </AppShell>
  )
}


