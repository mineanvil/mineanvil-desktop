import type { SafetySignal, SafetySignalInputs } from './safetySignal'

export interface EscalationCopy {
  heading?: string
  whatHappened: string
  whatItMeans: string
  whatNext: string
}

/**
 * Returns escalation copy for non-normal safety signals.
 * Returns null when signal is "normal" (no escalation needed).
 *
 * This function uses only the inputs already provided to safetySignal mapping.
 * No new state sources or backend calls are introduced.
 *
 * Triggers:
 * - ATTENTION (signed out): inputs.signedIn === false
 * - ATTENTION (temporary/verification): inputs.signedIn === true AND signal === "attention" AND inputs.ownershipState !== "NOT_OWNED"
 * - UNSUPPORTED: signal === "unsupported"
 */
export function getEscalationCopy(
  signal: SafetySignal,
  inputs: SafetySignalInputs | null
): EscalationCopy | null {
  // No escalation for normal state
  if (signal === 'normal') {
    return null
  }

  // No escalation if inputs are null (loading state)
  if (!inputs) {
    return null
  }

  const { signedIn, ownershipState } = inputs

  // ATTENTION — signed out
  if (!signedIn) {
    return {
      whatHappened: "You're currently signed out of your Microsoft account.",
      whatItMeans: "MineAnvil can't check ownership or prepare Minecraft until you're signed in.",
      whatNext: "Sign in when you're ready, and MineAnvil will take care of the rest.",
    }
  }

  // UNSUPPORTED — not owned OR app not approved (per SP3.2 mapping)
  if (signal === 'unsupported') {
    return {
      whatHappened: "This account can't be used with MineAnvil.",
      whatItMeans: "Minecraft ownership couldn't be confirmed for this account.",
      whatNext: "Try a different Microsoft account that owns Minecraft, or contact support for help.",
    }
  }

  // ATTENTION — temporarily unverified OR owned but not ready
  // Trigger: signedIn === true AND signal === "attention" AND ownershipState !== "NOT_OWNED"
  // This includes ownershipState "UNVERIFIED_TEMPORARY" or "UNVERIFIED_APP_NOT_APPROVED" or minecraftReady false while OWNED.
  if (signal === 'attention' && ownershipState !== 'NOT_OWNED') {
    return {
      whatHappened: 'MineAnvil is still confirming access or preparing Minecraft.',
      whatItMeans: "This is usually temporary and doesn't mean anything is wrong.",
      whatNext: 'You can wait a moment or try again later. If it doesn't resolve, support can help.',
    }
  }

  // Fallback: no escalation copy for unknown attention states
  return null
}

