import type { OwnershipState } from '../../electron/src/shared/ipc-types'

export type SafetySignal = 'normal' | 'attention' | 'unsupported'

export interface SafetySignalInfo {
  signal: SafetySignal
  title: string
  body: string
}

export interface SafetySignalInputs {
  signedIn: boolean
  ownershipState: OwnershipState | undefined
  minecraftReady: boolean
}

/**
 * Maps existing app state to a Safety Signal.
 * This is a pure function that derives the signal from already-available state.
 * No new backend calls or IPC messages are made.
 */
export function getSafetySignal(inputs: SafetySignalInputs | null): SafetySignalInfo {
  // Loading state - show neutral attention signal
  if (!inputs) {
    return {
      signal: 'attention',
      title: 'Checking status',
      body: 'MineAnvil is checking the current status.',
    }
  }

  const { signedIn, ownershipState, minecraftReady } = inputs

  // Unsupported: Account doesn't own Minecraft - MineAnvil cannot manage it
  if (ownershipState === 'NOT_OWNED') {
    return {
      signal: 'unsupported',
      title: 'Not supported right now',
      body: 'MineAnvil can\'t safely manage this setup.',
    }
  }

  // Normal: Signed in, owned, and Minecraft is ready
  if (signedIn && ownershipState === 'OWNED' && minecraftReady) {
    return {
      signal: 'normal',
      title: 'Everything looks good',
      body: 'Minecraft is ready and managed by MineAnvil.',
    }
  }

  // Attention: Signed out - needs sign in (not a health issue, just needs action)
  if (!signedIn) {
    return {
      signal: 'attention',
      title: 'Sign in to continue',
      body: 'Sign in to check ownership and get Minecraft ready.',
    }
  }

  // Attention: Signed in and owned, but Minecraft is not ready
  if (signedIn && ownershipState === 'OWNED' && !minecraftReady) {
    return {
      signal: 'attention',
      title: 'Action needed',
      body: 'MineAnvil can\'t start Minecraft yet.',
    }
  }

  // Attention: Verification pending or temporary issues (signed in but not owned)
  if (signedIn && (ownershipState === 'UNVERIFIED_APP_NOT_APPROVED' || ownershipState === 'UNVERIFIED_TEMPORARY')) {
    return {
      signal: 'attention',
      title: 'Action needed',
      body: 'MineAnvil can\'t start Minecraft yet. Verification is in progress.',
    }
  }

  // Fallback for unknown states
  return {
    signal: 'attention',
    title: 'Checking status',
    body: 'MineAnvil is checking the current status.',
  }
}

