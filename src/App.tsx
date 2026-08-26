import { useCallback, useEffect, useRef, useState } from 'react'
import { LedStrip, isSupported, type Status } from './ble'
import * as elk from './protocol/elk'

/** Cores de acesso rapido — o que a gente realmente usa no dia a dia. */
const SWATCHES = [
  '#ff0000', '#ff7b00', '#ffd000', '#3dff3d',
  '#00d4ff', '#0044ff', '#8a2be2', '#ff2d95',
  '#ffffff', '#ffb46b',
]

/**
 * Um slider de cor dispara dezenas de eventos por segundo e o BLE nao
 * aguenta esse ritmo. Mandamos no maximo um pacote por intervalo,
 * sempre com o valor mais recente.
 */
function useThrottledSend(delay = 60) {
  const timer = useRef<number | null>(null)
  const pending = useRef<(() => void) | null>(null)

  return useCallback(
    (fn: () => void) => {
      pending.current = fn
      if (timer.current !== null) return
      const flush = () => {
        const next = pending.current
        pending.current = null
        if (next) {
          next()
          timer.current = window.setTimeout(flush, delay)
        } else {
          timer.current = null
        }
      }
      flush()
    },
    [delay],
  )
}

export default function App() {
  const stripRef = useRef<LedStrip | null>(null)
  if (!stripRef.current) stripRef.current = new LedStrip()
  const strip = stripRef.current

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [color, setColor] = useState('#00d4ff')
  const [bright, setBright] = useState(100)

  const throttled = useThrottledSend()

  useEffect(() => {
    strip.onStatusChange = setStatus
  }, [strip])

  const connected = status === 'connected'

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const applyColor = (hex: string) => {
    setColor(hex)
    const [r, g, b] = elk.hexToRgb(hex)
    throttled(() => void strip.send(elk.color(r, g, b)))
  }

  const applyBrightness = (percent: number) => {
    setBright(percent)
    throttled(() => void strip.send(elk.brightness(percent)))
  }

  if (!isSupported()) {
    return (
      <main className="app">
        <div className="card unsupported">
          <h1>Navegador sem Bluetooth</h1>
          <p>
            Este app usa Web Bluetooth, que existe no <strong>Chrome no Android</strong> e
            em navegadores desktop baseados em Chromium.
          </p>
          <p className="dim">
            No iPhone nenhum navegador suporta a API — todos são obrigados a usar o motor
            do Safari.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="head">
        <h1>Fita LED</h1>
        <span className={`badge ${status}`}>
          {status === 'connected' && strip.name}
          {status === 'connecting' && 'conectando…'}
          {status === 'disconnected' && 'desconectado'}
          {status === 'idle' && 'sem conexão'}
        </span>
      </header>

      {!connected && (
        <div className="card">
          <button className="primary" onClick={() => run(() => strip.connect())}>
            {status === 'disconnected' ? 'Reconectar' : 'Conectar na fita'}
          </button>
          <button className="ghost" onClick={() => run(() => strip.connect(true))}>
            Não aparece? Listar todos os dispositivos
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <fieldset className="stack" disabled={!connected}>
        <div className="card row">
          <button className="primary" onClick={() => strip.send(elk.power(true))}>
            Ligar
          </button>
          <button className="ghost" onClick={() => strip.send(elk.power(false))}>
            Desligar
          </button>
        </div>

        <div className="card">
          <label className="label">Cor</label>
          <input
            className="picker"
            type="color"
            value={color}
            onChange={(e) => applyColor(e.target.value)}
          />
          <div className="swatches">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                className={`swatch ${hex === color ? 'on' : ''}`}
                style={{ background: hex }}
                onClick={() => applyColor(hex)}
                aria-label={hex}
              />
            ))}
          </div>
        </div>

        <div className="card">
          <label className="label">
            Brilho <span className="dim">{bright}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={bright}
            onChange={(e) => applyBrightness(Number(e.target.value))}
          />
        </div>

        <div className="card">
          <label className="label">Efeitos</label>
          <div className="effects">
            {elk.EFFECTS.map((fx) => (
              <button key={fx.mode} className="chip" onClick={() => strip.send(elk.effect(fx.mode))}>
                {fx.label}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      {connected && (
        <button className="ghost wide" onClick={() => strip.disconnect()}>
          Desconectar
        </button>
      )}
    </main>
  )
}
