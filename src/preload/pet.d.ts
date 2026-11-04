import type { PetApi } from './pet'

declare global {
  interface Window {
    pet: PetApi
  }
}

export {}
