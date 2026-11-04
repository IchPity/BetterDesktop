import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './pet.css'
import { PetApp } from './PetApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PetApp />
  </StrictMode>
)
