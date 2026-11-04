import type { PetCharacter } from '@shared/settings'
import type { PetState } from '@shared/pet'
import './pet-sprite.css'

const INK = '#1b1d26'
const CHEEK = '#ff8fa8'

type EyeMood = 'open' | 'closed' | 'happy' | 'wide'

function moodFor(state: PetState): EyeMood {
  if (state === 'sleep') return 'closed'
  if (state === 'happy') return 'happy'
  if (state === 'alert' || state === 'fall' || state === 'drag') return 'wide'
  return 'open'
}

/** A pair of eyes in the given mood. Open eyes blink via CSS. */
function Eyes({ at, r, color, mood }: { at: Array<[number, number]>; r: number; color: string; mood: EyeMood }): React.JSX.Element {
  return (
    <g className={mood === 'open' ? 'pet-eyes pet-blink' : 'pet-eyes'}>
      {at.map(([x, y]) => {
        if (mood === 'closed')
          return <path key={x} d={`M${x - r} ${y} Q${x} ${y + r * 0.8} ${x + r} ${y}`} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        if (mood === 'happy')
          return <path key={x} d={`M${x - r} ${y + 1} Q${x} ${y - r * 1.1} ${x + r} ${y + 1}`} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        const rr = mood === 'wide' ? r * 1.25 : r
        return (
          <g key={x}>
            <circle cx={x} cy={y} r={rr} fill={color} />
            <circle cx={x + rr * 0.35} cy={y - rr * 0.4} r={rr * 0.35} fill="#fff" opacity={color === INK ? 0.9 : 0.6} />
          </g>
        )
      })}
    </g>
  )
}

function Blob({ mood }: { mood: EyeMood }): React.JSX.Element {
  return (
    <g className="pet-body">
      <path d="M50 30 C72 30 84 50 84 72 C84 88 72 95 50 95 C28 95 16 88 16 72 C16 50 28 30 50 30 Z" fill="var(--pet)" />
      <path d="M18 78 C22 90 36 95 50 95 C64 95 78 90 82 78 C74 87 62 90 50 90 C38 90 26 87 18 78 Z" fill="var(--pet-shade)" opacity={0.45} />
      <ellipse cx={35} cy={46} rx={7} ry={4} fill="#fff" opacity={0.35} transform="rotate(-35 35 46)" />
      <Eyes at={[[40, 64], [60, 64]]} r={4.5} color={INK} mood={mood} />
      <ellipse cx={31} cy={73} rx={4.5} ry={2.6} fill={CHEEK} opacity={0.55} />
      <ellipse cx={69} cy={73} rx={4.5} ry={2.6} fill={CHEEK} opacity={0.55} />
      {mood === 'wide' ? (
        <ellipse cx={50} cy={75} rx={3} ry={3.5} fill={INK} />
      ) : (
        <path d="M46 73 Q50 77 54 73" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      )}
    </g>
  )
}

function Cat({ mood }: { mood: EyeMood }): React.JSX.Element {
  return (
    <>
      <path className="pet-tail" d="M30 84 C14 84 10 70 17 60" stroke="var(--pet-shade)" strokeWidth={7} fill="none" strokeLinecap="round" />
      <g className="pet-leg-b">
        <rect x={34} y={84} width={8} height={11} rx={4} fill="var(--pet-shade)" />
        <rect x={56} y={84} width={8} height={11} rx={4} fill="var(--pet-shade)" />
      </g>
      <g className="pet-body">
        <ellipse cx={50} cy={78} rx={23} ry={14} fill="var(--pet)" />
        <path d="M32 42 L29 18 L47 32 Z" fill="var(--pet)" />
        <path d="M68 42 L71 18 L53 32 Z" fill="var(--pet)" />
        <path d="M34 36 L32.5 24 L42 31 Z" fill={CHEEK} opacity={0.6} />
        <path d="M66 36 L67.5 24 L58 31 Z" fill={CHEEK} opacity={0.6} />
        <circle cx={50} cy={50} r={22} fill="var(--pet)" />
        <ellipse cx={50} cy={58} rx={11} ry={7} fill="#fff" opacity={0.25} />
        <Eyes at={[[42, 49], [58, 49]]} r={3.6} color={INK} mood={mood} />
        <path d="M48 55.5 L52 55.5 L50 58 Z" fill={CHEEK} />
        <path d="M47 60 Q50 62.5 50 59 Q50 62.5 53 60" stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <g stroke={INK} strokeWidth={1} opacity={0.45} strokeLinecap="round">
          <path d="M36 57 L25 55" />
          <path d="M36 60 L25 61" />
          <path d="M64 57 L75 55" />
          <path d="M64 60 L75 61" />
        </g>
      </g>
      <g className="pet-leg-a">
        <rect x={39} y={85} width={8} height={10} rx={4} fill="var(--pet)" />
        <rect x={60} y={85} width={8} height={10} rx={4} fill="var(--pet)" />
      </g>
    </>
  )
}

function Bot({ mood }: { mood: EyeMood }): React.JSX.Element {
  return (
    <>
      <g className="pet-leg-a">
        <rect x={36} y={84} width={10} height={11} rx={3.5} fill={INK} opacity={0.85} />
      </g>
      <g className="pet-leg-b">
        <rect x={54} y={84} width={10} height={11} rx={3.5} fill={INK} opacity={0.85} />
      </g>
      <g className="pet-body">
        <line x1={50} y1={22} x2={50} y2={32} stroke="var(--pet-shade)" strokeWidth={3} strokeLinecap="round" />
        <circle className="pet-antenna" cx={50} cy={19} r={4.5} fill="var(--pet)" />
        <rect x={34} y={66} width={32} height={20} rx={7} fill="var(--pet-shade)" />
        <rect x={26} y={70} width={8} height={12} rx={4} fill="var(--pet)" />
        <rect x={66} y={70} width={8} height={12} rx={4} fill="var(--pet)" />
        <circle cx={50} cy={76} r={3} fill="#fff" opacity={0.5} />
        <rect x={24} y={30} width={52} height={38} rx={13} fill="var(--pet)" />
        <rect x={30} y={36} width={40} height={26} rx={9} fill={INK} />
        <Eyes at={[[42, 49], [58, 49]]} r={4} color="#9ff3ff" mood={mood} />
        {mood === 'happy' && <path d="M46 56 Q50 59 54 56" stroke="#9ff3ff" strokeWidth={1.8} fill="none" strokeLinecap="round" />}
      </g>
    </>
  )
}

const BODIES: Record<PetCharacter, (p: { mood: EyeMood }) => React.JSX.Element> = { blob: Blob, cat: Cat, bot: Bot }

/** Small decorations that are never mirrored (text must stay readable). */
function Extras({ state }: { state: PetState }): React.JSX.Element | null {
  if (state === 'sleep')
    return (
      <g className="pet-zzz" fill="var(--pet-text)" fontFamily="system-ui, sans-serif" fontWeight={700}>
        <text x={72} y={34} fontSize={11}>z</text>
        <text x={80} y={24} fontSize={14}>z</text>
        <text x={89} y={12} fontSize={17}>Z</text>
      </g>
    )
  if (state === 'happy')
    return (
      <path
        className="pet-heart"
        d="M82 22 C82 17 88 16 89 21 C90 16 96 17 96 22 C96 27 89 31 89 31 C89 31 82 27 82 22 Z"
        fill="#ff6b8b"
      />
    )
  if (state === 'alert')
    return (
      <g className="pet-exclaim">
        <rect x={84} y={8} width={6} height={16} rx={3} fill="#f5b041" />
        <circle cx={87} cy={29} r={3.2} fill="#f5b041" />
      </g>
    )
  return null
}

/** Characters look right by default; mirror them when walking left. */
const NATURAL_FACING: Record<PetCharacter, 'left' | 'right'> = { blob: 'right', cat: 'right', bot: 'right' }

export function PetSprite({
  character,
  state,
  facing = 'right',
  accent,
  size,
  reduceMotion = false,
  className
}: {
  character: PetCharacter
  state: PetState
  facing?: 'left' | 'right'
  accent: string
  size: number
  reduceMotion?: boolean
  className?: string
}): React.JSX.Element {
  const Body = BODIES[character]
  const flip = facing !== NATURAL_FACING[character]
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={['pet', `pet-${character}`, `pet-state-${state}`, reduceMotion && 'pet-still', className].filter(Boolean).join(' ')}
      style={{ ['--pet' as string]: accent }}
      aria-hidden
    >
      <ellipse className="pet-shadow" cx={50} cy={96} rx={24} ry={3.5} fill="#000" opacity={0.18} />
      <g transform={flip ? 'translate(100 0) scale(-1 1)' : undefined}>
        <g className="pet-figure">
          <Body mood={moodFor(state)} />
        </g>
      </g>
      <Extras state={state} />
    </svg>
  )
}
