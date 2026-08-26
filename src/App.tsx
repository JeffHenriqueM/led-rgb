import { useCallback, useRef, useState } from 'react'
import { LedStrip, isSupported } from './ble'
import { getName, setName } from './names'
import * as elk from './protocol/elk'

/** Cores de acesso rápido — o que a gente realmente usa no dia a dia. */
const SWATCHES = [
  '#ff0000', '#ff7b00', '#ffd000', '#3dff3d',
  '#00d4ff', '#0044ff', '#8a2be2', '#ff2d95',
  '#ffffff', '#ffb46b',
]

/**
 * Um slider de cor dispara dezenas de eventos por segundo e o BLE não
 * aguenta esse ritmo. Mandamos no máximo um pacote por intervalo,
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
  const [strips, setStrips] = useState<LedStrip[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [color, setColor] = useState('#00d4ff')
  const [bright, setBright] = useState(100)
  const [speed, setSpeed] = useState(50)
  const [lastEffect, setLastEffect] = useState<number | null>(null)

  // As mudanças de estado vivem dentro dos objetos LedStrip, não no React.
  // Este contador existe só pra forçar o re-render quando elas acontecem.
  const [, bump] = useState(0)
  const rerender = useCallback(() => bump((n) => n + 1), [])

  const throttled = useThrottledSend()

  /** Só as fitas marcadas E conectadas recebem comando. */
  const targets = strips.filter((s) => selected.has(s.id) && s.connected)
  const canControl = targets.length > 0

  const broadcast = (packet: elk.Packet) => {
    for (const strip of targets) void strip.send(packet)
  }

  const addStrip = async (anyDevice: boolean) => {
    setError(null)
    const strip = new LedStrip()
    strip.onStatusChange = rerender
    try {
      await strip.connect(anyDevice)
    } catch (err) {
      // Cancelar o seletor cai aqui e não é erro que mereça alarde.
      const message = err instanceof Error ? err.message : String(err)
      if (!/cancel|user/i.test(message)) setError(message)
      return
    }

    if (strips.some((s) => s.id === strip.id)) {
      strip.disconnect()
      setError('Essa fita já está na lista.')
      return
    }

    setStrips((prev) => [...prev, strip])
    setSelected((prev) => new Set(prev).add(strip.id))
  }

  const removeStrip = (strip: LedStrip) => {
    strip.disconnect()
    setStrips((prev) => prev.filter((s) => s !== strip))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(strip.id)
      return next
    })
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyColor = (hex: string) => {
    setColor(hex)
    const [r, g, b] = elk.hexToRgb(hex)
    throttled(() => broadcast(elk.color(r, g, b)))
  }

  const applyBrightness = (percent: number) => {
    setBright(percent)
    throttled(() => broadcast(elk.brightness(percent)))
  }

  const applySpeed = (percent: number) => {
    setSpeed(percent)
    throttled(() => broadcast(elk.speed(percent)))
  }

  if (!isSupported()) {
    return (
      <main className="app">
        <div className="card unsupported">
          <h1>Navegador sem Bluetooth</h1>
          <p>
            Este app usa Web Bluetooth, que existe no <strong>Chrome no Android</strong> e
            nos navegadores desktop baseados em Chromium.
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
        {strips.length > 0 && (
          <span className="badge">
            {targets.length} de {strips.length} selecionada{strips.length > 1 ? 's' : ''}
          </span>
        )}
      </header>

      <div className="card">
        {strips.length === 0 && (
          <p className="empty">Nenhuma fita conectada ainda.</p>
        )}

        {strips.map((strip) => (
          <div className="strip" key={strip.id}>
            <button
              className={`check ${selected.has(strip.id) ? 'on' : ''}`}
              onClick={() => toggle(strip.id)}
              aria-label="Selecionar"
            />
            <span className={`dot ${strip.status}`} />
            <input
              className="rename"
              defaultValue={getName(strip.id, strip.name)}
              onChange={(e) => setName(strip.id, e.target.value)}
              placeholder={strip.name}
            />
            {strip.status === 'disconnected' && (
              <button
                className="mini"
                onClick={() => strip.reconnect().catch((e) => setError(String(e)))}
              >
                Reconectar
              </button>
            )}
            <button className="mini" onClick={() => removeStrip(strip)} aria-label="Remover">
              ✕
            </button>
          </div>
        ))}

        <button className="primary" onClick={() => addStrip(false)}>
          {strips.length === 0 ? 'Conectar na fita' : 'Adicionar outra fita'}
        </button>
        <button className="ghost" onClick={() => addStrip(true)}>
          Não aparece? Listar todos os dispositivos
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <fieldset className="stack" disabled={!canControl}>
        <div className="card row">
          <button className="primary" onClick={() => broadcast(elk.power(true))}>
            Ligar
          </button>
          <button className="ghost" onClick={() => broadcast(elk.power(false))}>
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
          <label className="label">
            Efeitos <span className="dim">{elk.EFFECT_MODES.length} modos do controlador</span>
          </label>
          <div className="effects">
            {elk.EFFECT_MODES.map((mode, i) => (
              <button
                key={mode}
                className={`chip ${mode === lastEffect ? 'on' : ''}`}
                onClick={() => {
                  setLastEffect(mode)
                  broadcast(elk.effect(mode))
                }}
              >
                {getName(`fx:${mode}`, `${i + 1}`)}
              </button>
            ))}
          </div>

          {lastEffect !== null && (
            <input
              key={lastEffect}
              className="rename naming"
              defaultValue={getName(`fx:${lastEffect}`, '')}
              placeholder="O que apareceu? Dê um nome a este efeito"
              onChange={(e) => {
                setName(`fx:${lastEffect}`, e.target.value)
                rerender()
              }}
            />
          )}

          <label className="label">
            Velocidade <span className="dim">{speed}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={speed}
            onChange={(e) => applySpeed(Number(e.target.value))}
          />
        </div>
      </fieldset>
    </main>
  )
}
