import { useEffect, useMemo, useState } from 'react'
import type { MineAnvilApi } from '../../../electron/src/shared/ipc-types'
import type { LicenseMode } from '../../ux/flowTypes'

function failureMessage(res: { error?: string; failure?: { userMessage: string } }, fallback: string): string {
  return res.failure?.userMessage ?? res.error ?? fallback
}

export function MinecraftSetupScreen(props: {
  api: MineAnvilApi
  licenseMode: LicenseMode
  onSuccess: () => void
  onFailure: (error: string) => void
}) {
  const gameId = 'minecraft' as const
  const [progress, setProgress] = useState<number>(5)
  const [statusLine, setStatusLine] = useState<string>('Checking installation')

  const hasProgressApi = useMemo(() => {
    return typeof window !== 'undefined' && Boolean((window as any).mineanvilInstallProgress)
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        // Step: Checking installation
        setStatusLine('Checking installation')
        setProgress(10)

        // Step: Downloading Minecraft
        setStatusLine('Downloading Minecraft')
        setProgress(55)

        const prepare = await props.api.gamePrepare(gameId)
        if (!prepare.ok) throw new Error(failureMessage(prepare, 'Could not prepare Minecraft.'))
        setProgress(80)

        // Step: Preparing game files
        setStatusLine('Preparing game files')
        setProgress(90)

        setProgress(100)
        if (!cancelled) props.onSuccess()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!cancelled) props.onFailure(msg)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [props])

  return (
    <div className="setup-shell">
      <div className="setup-card">
        <h1 className="setup-title">Minecraft Setup</h1>

        <div className="setup-progress">
          <p className="setup-subtitle">{statusLine}</p>
          <div className="setup-progress-track" aria-label="Setup progress">
            <div className="setup-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <p className="setup-secondary">
            {hasProgressApi ? 'This may take a few minutes.' : 'This may take a moment.'}
          </p>
        </div>
      </div>
    </div>
  )
}


