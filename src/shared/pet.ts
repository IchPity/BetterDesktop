import type { PetCharacter } from './settings'

export type PetState = 'idle' | 'walk' | 'sleep' | 'happy' | 'alert' | 'drag' | 'fall'

export interface PetBubble {
  text: string
  tone: 'info' | 'warning'
}

/** Everything the pet window needs to draw itself. Pushed by the main process. */
export interface PetView {
  character: PetCharacter
  /** Sprite edge length in CSS pixels. */
  spriteSize: number
  accent: string
  state: PetState
  facing: 'left' | 'right'
  bubble: PetBubble | null
  focusMode: boolean
  reduceMotion: boolean
}

/** What the app window shows about the pet. */
export interface PetStatus {
  visible: boolean
  state: PetState
  timer: { endsAt: number; minutes: number } | null
}

export const PET_TIMER_MINUTES = [5, 10, 15, 25, 45, 60] as const

export type PetCommand =
  | { type: 'reset-position' }
  | { type: 'sleep' }
  | { type: 'wake' }
  | { type: 'timer'; minutes: number }
  | { type: 'cancel-timer' }
