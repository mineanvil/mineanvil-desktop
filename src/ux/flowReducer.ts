import type { AppTab, LicenseMode, SetupScreen, UxPhase } from './flowTypes'
import type { GameId } from '../../electron/src/shared/ipc-types'

export type UxFlowState = {
  phase: UxPhase
  setupScreen: SetupScreen
  appTab: AppTab
  gameId: GameId
  licenseMode: LicenseMode
  username?: string
  error?: string
}

export type UxFlowAction =
  | { type: 'SET_USERNAME'; username?: string }
  | { type: 'SET_LICENSE_MODE'; licenseMode: LicenseMode }
  | { type: 'GO_TO_SETUP_WELCOME' }
  | { type: 'SETUP_GET_STARTED' }
  | { type: 'AUTH_GO_TO_SIGN_IN' }
  | { type: 'AUTH_SIGN_IN_SUCCESS'; username?: string }
  | { type: 'AUTH_SIGN_IN_FAILURE'; error: string }
  | { type: 'LICENSE_VERIFIED'; username?: string }
  | { type: 'LICENSE_NOT_FOUND'; username?: string }
  | { type: 'LICENSE_CONTINUE_DEMO'; username?: string }
  | { type: 'SETUP_PROGRESS_TO_APP' }
  | { type: 'SETUP_FAILURE'; error: string }
  | { type: 'SETUP_TRY_AGAIN' }
  | { type: 'APP_SELECT_TAB'; tab: AppTab }
  | { type: 'APP_SIGN_OUT' }
  | { type: 'BOOTSTRAP_APP_READY'; username?: string; licenseMode: Exclude<LicenseMode, 'unknown'> }
  | { type: 'BOOTSTRAP_SETUP_LICENSE'; username?: string }

export const initialUxFlowState: UxFlowState = {
  phase: 'setup',
  setupScreen: 'welcome',
  appTab: 'home',
  gameId: 'minecraft',
  licenseMode: 'unknown',
}

export function uxFlowReducer(state: UxFlowState, action: UxFlowAction): UxFlowState {
  switch (action.type) {
    case 'SET_USERNAME':
      return { ...state, username: action.username }

    case 'SET_LICENSE_MODE':
      return { ...state, licenseMode: action.licenseMode }

    case 'GO_TO_SETUP_WELCOME':
      return { ...initialUxFlowState }

    case 'SETUP_GET_STARTED':
      if (state.phase !== 'setup' || state.setupScreen !== 'welcome') return state
      return { ...state, setupScreen: 'microsoftSignIn', error: undefined }

    case 'AUTH_GO_TO_SIGN_IN':
      if (state.phase !== 'setup') return state
      return { ...state, setupScreen: 'microsoftSignIn', error: undefined }

    case 'AUTH_SIGN_IN_SUCCESS':
      if (state.phase !== 'setup' || state.setupScreen !== 'microsoftSignIn') return state
      return { ...state, setupScreen: 'licenseResolution', username: action.username ?? state.username, error: undefined }

    case 'AUTH_SIGN_IN_FAILURE':
      if (state.phase !== 'setup') return state
      return { ...state, setupScreen: 'setupError', error: action.error }

    case 'LICENSE_VERIFIED':
      if (state.phase !== 'setup' || state.setupScreen !== 'licenseResolution') return state
      return {
        ...state,
        setupScreen: 'minecraftSetup',
        licenseMode: 'full',
        username: action.username ?? state.username,
        error: undefined,
      }

    case 'LICENSE_NOT_FOUND':
      if (state.phase !== 'setup' || state.setupScreen !== 'licenseResolution') return state
      return { ...state, licenseMode: 'unknown', username: action.username ?? state.username, error: undefined }

    case 'LICENSE_CONTINUE_DEMO':
      if (state.phase !== 'setup' || state.setupScreen !== 'licenseResolution') return state
      return {
        ...state,
        setupScreen: 'minecraftSetup',
        licenseMode: 'demo',
        username: action.username ?? state.username,
        error: undefined,
      }

    case 'SETUP_PROGRESS_TO_APP':
      if (state.phase !== 'setup' || state.setupScreen !== 'minecraftSetup') return state
      return { ...state, phase: 'app', setupScreen: 'welcome', appTab: 'home', error: undefined }

    case 'SETUP_FAILURE':
      if (state.phase !== 'setup') return state
      return { ...state, setupScreen: 'setupError', error: action.error }

    case 'SETUP_TRY_AGAIN':
      if (state.phase !== 'setup' || state.setupScreen !== 'setupError') return state
      return { ...state, setupScreen: 'minecraftSetup', error: undefined }

    case 'APP_SELECT_TAB':
      if (state.phase !== 'app') return state
      return { ...state, appTab: action.tab }

    case 'APP_SIGN_OUT':
      // Return to the start of Phase A (A0 Welcome). Users advance explicitly via "Get Started".
      return { ...initialUxFlowState }

    case 'BOOTSTRAP_APP_READY':
      return {
        phase: 'app',
        setupScreen: 'welcome',
        appTab: 'home',
        gameId: 'minecraft',
        licenseMode: action.licenseMode,
        username: action.username,
        error: undefined,
      }

    case 'BOOTSTRAP_SETUP_LICENSE':
      return {
        phase: 'setup',
        setupScreen: 'licenseResolution',
        appTab: 'home',
        gameId: 'minecraft',
        licenseMode: 'unknown',
        username: action.username,
        error: undefined,
      }

    default:
      return state
  }
}


