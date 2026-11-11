import clsx from 'clsx'

// Mascotte de bienvenue : un agriculteur ou une agricultrice du Sénégal, en buste, dessinés pour le projet.
// Le bras levé salue puis désigne le globe (animation .mascotte-* dans index.css) ; avec « réduire les
// animations », le personnage est immobile, la main levée.

export type Genre = 'agriculteur' | 'agricultrice'

const TEINTES: Record<Genre, { peau: string; ombre: string; habit: string; habitSombre: string; habitClair: string }> = {
  agriculteur: { peau: '#6a4126', ombre: '#52301b', habit: '#3d6a94', habitSombre: '#2f5477', habitClair: '#7fa8cc' },
  agricultrice: { peau: '#74482b', ombre: '#5a361f', habit: '#2a5a86', habitSombre: '#1f4567', habitClair: '#f2b544' },
}

const EPIS = [
  { x: 52, y: 268, angle: -30 },
  { x: 72, y: 252, angle: -20 },
  { x: 94, y: 246, angle: -10 },
]

/** Poignée d'épis de mil tenue contre la poitrine. */
function EpisDeMil() {
  return (
    <g>
      {EPIS.map((e) => (
        <g key={e.x}>
          <path d={`M121 356 L${e.x} ${e.y}`} stroke="#7fae6b" strokeWidth="3" strokeLinecap="round" />
          <g transform={`translate(${e.x} ${e.y}) rotate(${e.angle})`}>
            <rect x="-5.5" y="-54" width="11" height="58" rx="5.5" fill="#e0b24f" />
            <path d="M0 -49 V0" stroke="#8a5527" strokeWidth="5" strokeDasharray="1 3.4" opacity="0.45" />
          </g>
        </g>
      ))}
    </g>
  )
}

function ChapeauDePaille() {
  return (
    <g>
      <ellipse cx="160" cy="161" rx="80" ry="17" fill="#b9954f" />
      <ellipse cx="160" cy="157" rx="80" ry="16" fill="#dcba6e" />
      <path d="M118 158 C118 112 138 95 160 95 C182 95 202 112 202 158Z" fill="#e6c880" />
      <path d="M119 149 C140 158 180 158 201 149 L202 158 C180 167 140 167 118 158Z" fill="#8a5527" />
      <path d="M132 112 C140 103 150 99 160 99" stroke="#f4dfa6" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
    </g>
  )
}

function Foulard() {
  return (
    <g>
      <path d="M116 190 C106 132 138 98 166 100 C202 102 216 142 205 190 C192 162 138 158 116 190Z" fill="#c9772f" />
      <ellipse cx="198" cy="110" rx="21" ry="14" transform="rotate(28 198 110)" fill="#d98a3d" />
      <path d="M128 150 C146 132 178 130 196 146 M134 128 C150 114 174 112 190 124" stroke="#f2b544" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75" />
    </g>
  )
}

export function Mascotte({ genre, anime, className }: { genre: Genre; anime: boolean; className?: string }) {
  const t = TEINTES[genre]
  const femme = genre === 'agricultrice'

  return (
    <svg viewBox="0 0 320 420" className={clsx('mascotte', anime && 'mascotte-animee', className)} aria-hidden>
      <g className="mascotte-buste">
        {/* Buste et tenue de travail */}
        <path d={femme ? 'M78 420 C80 344 102 282 160 274 C218 282 240 344 242 420Z' : 'M70 420 C72 340 96 278 160 270 C224 278 248 340 250 420Z'} fill={t.habit} />
        {femme ? (
          <>
            <ellipse cx="160" cy="278" rx="27" ry="13" fill={t.peau} />
            <path d="M133 280 C140 294 180 294 187 280" stroke={t.habitClair} strokeWidth="3" fill="none" strokeLinecap="round" />
            {[[112, 338], [146, 356], [184, 340], [210, 372], [124, 386], [170, 394]].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill={t.habitClair} opacity="0.55" />
            ))}
          </>
        ) : (
          <path d="M138 272 L160 304 L182 272" stroke={t.habitClair} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Cou et visage */}
        <rect x="146" y="230" width="28" height="48" rx="10" fill={t.ombre} />
        <ellipse cx="120" cy="202" rx="7" ry="11" fill={t.ombre} />
        <ellipse cx="200" cy="202" rx="7" ry="11" fill={t.ombre} />
        <ellipse cx="160" cy="196" rx="40" ry="48" fill={t.peau} />
        {!femme && <path d="M123 206 C127 246 150 258 160 258 C170 258 193 246 197 206 C189 232 173 241 160 241 C147 241 131 232 123 206Z" fill="#2c1d14" opacity="0.5" />}
        <path d="M139 181 q7 -4 14 -1 M167 180 q7 -3 14 1" stroke="#22140b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <ellipse cx="146" cy="192" rx="3" ry="3.3" fill="#1a0f08" />
        <ellipse cx="174" cy="192" rx="3" ry="3.3" fill="#1a0f08" />
        <path d="M160 197 q-5 12 2 15" stroke={t.ombre} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M145 221 q15 11 30 0" stroke="#2a160c" strokeWidth="2.8" strokeLinecap="round" fill="none" />
        {femme && (
          <>
            <circle cx="120" cy="216" r="4.5" fill="#f2b544" />
            <circle cx="200" cy="216" r="4.5" fill="#f2b544" />
          </>
        )}
        {femme ? <Foulard /> : <ChapeauDePaille />}

        {/* Bras qui tient les épis */}
        <EpisDeMil />
        <path d="M86 308 C70 350 80 386 120 356" stroke={t.habitSombre} strokeWidth="30" strokeLinecap="round" fill="none" />
        <circle cx="121" cy="355" r="13" fill={t.peau} />

        {/* Bras qui salue, puis désigne le globe */}
        <g className="mascotte-bras">
          <path d="M232 304 V246" stroke={t.habitSombre} strokeWidth="30" strokeLinecap="round" />
          <path d="M232 244 V190" stroke={t.peau} strokeWidth="21" strokeLinecap="round" />
          <ellipse cx="232" cy="174" rx="13" ry="15" fill={t.peau} />
          <path d="M223 165 L220 150 M229 162 L228 145 M236 162 L237 146 M242 166 L246 152" stroke={t.peau} strokeWidth="5.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
