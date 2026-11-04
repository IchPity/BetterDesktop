import { useEffect, useRef, useState } from 'react'
import type { PetView } from '@shared/pet'
import { PetSprite } from '@/components/pet/PetSprite'

const DRAG_THRESHOLD = 4

/**
 * Renders the Desktop Pet. The window ignores the mouse except over the
 * sprite or bubble (data-hit), so the desktop below stays clickable.
 * Movement and behaviour live in the main process (PetController).
 */
export function PetApp(): React.JSX.Element | null {
  const [view, setView] = useState<PetView | null>(null)
  const [hover, setHover] = useState(false)
  const [dragging, setDragging] = useState(false)
  const press = useRef<{ x: number; y: number; dragging: boolean } | null>(null)

  useEffect(() => {
    const off = window.pet.onView(setView)
    void window.pet.view().then(setView)
    return off
  }, [])

  // Click-through everywhere except over the pet itself.
  useEffect(() => {
    let current = false
    const set = (on: boolean): void => {
      if (on === current) return
      current = on
      setHover(on)
      void window.pet.setInteractive(on)
    }
    const onMove = (e: MouseEvent): void => {
      if (press.current) return
      set(!!(e.target as Element | null)?.closest?.('[data-hit]'))
    }
    const onLeave = (): void => {
      if (!press.current) set(false)
    }
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  if (!view) return null

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    press.current = { x: e.screenX, y: e.screenY, dragging: false }
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const p = press.current
    if (!p || p.dragging) return
    if (Math.hypot(e.screenX - p.x, e.screenY - p.y) > DRAG_THRESHOLD) {
      p.dragging = true
      setDragging(true)
      void window.pet.dragStart()
    }
  }
  const onPointerUp = (): void => {
    const p = press.current
    press.current = null
    if (!p) return
    if (p.dragging) {
      setDragging(false)
      void window.pet.dragEnd()
    } else {
      void window.pet.poke()
    }
  }

  return (
    <div className={['pet-stage', view.focusMode && 'focus', hover && 'hover'].filter(Boolean).join(' ')}>
      {view.bubble && (
        <div
          data-hit
          className={`pet-bubble ${view.bubble.tone}`}
          style={{ bottom: view.spriteSize + 6 }}
          title="Click to dismiss"
          onClick={() => void window.pet.dismissBubble()}
        >
          {view.bubble.text}
        </div>
      )}
      <div
        data-hit
        className={dragging ? 'pet-hit dragging' : 'pet-hit'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => void window.pet.openApp()}
        onContextMenu={(e) => {
          e.preventDefault()
          void window.pet.menu()
        }}
      >
        <PetSprite
          character={view.character}
          state={view.state}
          facing={view.facing}
          accent={view.accent}
          size={view.spriteSize}
          reduceMotion={view.reduceMotion}
        />
      </div>
    </div>
  )
}
