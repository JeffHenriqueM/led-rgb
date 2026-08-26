/**
 * Apelidos das fitas. O navegador so devolve "Dispositivo desconhecido"
 * pra boa parte dos controladores, entao quem sabe qual e a da sala e
 * qual e a do quarto e o usuario — e essa escolha precisa sobreviver a
 * um reload.
 *
 * A chave e o `device.id` do Web Bluetooth, estavel por origem.
 */
const KEY = 'led-rgb:names'

type Names = Record<string, string>

function read(): Names {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Names
  } catch {
    return {}
  }
}

export function getName(id: string, fallback: string): string {
  return read()[id] || fallback
}

export function setName(id: string, name: string): void {
  const all = read()
  const trimmed = name.trim()
  if (trimmed) all[id] = trimmed
  else delete all[id]
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Modo anonimo / storage cheio: perder o apelido nao quebra nada.
  }
}
