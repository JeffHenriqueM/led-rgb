/**
 * Protocolo ELK-BLEDOM / MELK-*
 *
 * Familia de controladores BLE da ELK, vendidos com nomes como
 * "ELK-BLEDOM", "MELK-OA10", "MELK-OB..." etc. Todos falam o mesmo
 * dialeto: pacotes de 9 bytes comecando em 0x7E e terminando em 0xEF.
 *
 *   7E  <sempre>
 *   00  <sempre>
 *   XX  <comando: 01=brilho 02=velocidade 03=efeito 04=power 05=cor>
 *   ..  <5 bytes de payload, dependem do comando>
 *   EF  <sempre>
 *
 * Nada aqui toca em Bluetooth de proposito: sao funcoes puras que
 * recebem valores e devolvem bytes. Se o seu controlador for uma
 * variante que responde diferente, este e o unico arquivo que muda.
 */

/** UUID do service GATT exposto pelo controlador. */
export const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'

/** Caracteristica de escrita (WRITE NO RESPONSE). E por aqui que tudo passa. */
export const WRITE_UUID = '0000fff3-0000-1000-8000-00805f9b34fb'

/** Prefixos de nome usados pra filtrar o dispositivo no scan. */
export const NAME_PREFIXES = ['ELK-BLE', 'ELK-BULB', 'MELK', 'LEDBLE']

const HEADER = 0x7e
const FOOTER = 0xef

/** Um pacote de 9 bytes pronto pra escrita no GATT. */
export type Packet = ReturnType<typeof packet>

function packet(cmd: number, payload: number[]) {
  const body = [...payload, 0, 0, 0, 0, 0].slice(0, 5)
  return new Uint8Array([HEADER, 0x00, cmd, ...body, FOOTER])
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Liga ou desliga a fita. */
export function power(on: boolean): Packet {
  // 7E 00 04 F0 00 01 FF 00 EF  (ligar)
  // 7E 00 04 00 00 00 FF 00 EF  (desligar)
  return on
    ? packet(0x04, [0xf0, 0x00, 0x01, 0xff, 0x00])
    : packet(0x04, [0x00, 0x00, 0x00, 0xff, 0x00])
}

/** Cor solida. Cada canal vai de 0 a 255. */
export function color(r: number, g: number, b: number): Packet {
  // 7E 00 05 03 RR GG BB 00 EF
  return packet(0x05, [0x03, clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), 0x00])
}

/** Brilho global, 0 a 100 (%). */
export function brightness(percent: number): Packet {
  // 7E 00 01 <0-100> 00 00 00 00 EF
  return packet(0x01, [clamp(percent, 0, 100)])
}

/** Velocidade dos efeitos animados, 0 a 100. */
export function speed(percent: number): Packet {
  // 7E 00 02 <0-100> 00 00 00 00 EF
  return packet(0x02, [clamp(percent, 0, 100)])
}

/**
 * Ativa um dos efeitos embutidos no controlador.
 *
 * O byte apos o modo e a velocidade da animacao. O valor 0x03 aparece
 * como padrao na maior parte da documentacao da familia, mas a escala
 * exata (e ate o sentido — se maior e mais rapido ou mais lento) varia
 * entre revisoes. Por isso ele e parametro, e nao constante.
 */
export function effect(mode: number, speedByte = 0x03): Packet {
  // 7E 00 03 <modo> <velocidade> 00 00 00 EF
  return packet(0x03, [clamp(mode, 0x80, 0x9d), clamp(speedByte, 0, 100)])
}

/**
 * O controlador tem 30 efeitos embutidos, nos modos 0x80 a 0x9D.
 *
 * Nao ha tabela oficial do que cada um faz, e ela varia entre revisoes
 * de hardware — por isso a interface mostra todos e deixa o usuario
 * nomear o que viu, em vez de confiar num rotulo chutado.
 */
export const EFFECT_MODES = Array.from({ length: 0x9d - 0x80 + 1 }, (_, i) => 0x80 + i)

/**
 * Nomes observados na fita do Jeff, na ordem de EFFECT_MODES.
 *
 * Nao vieram de documentacao: sao o que aparece de fato quando cada modo
 * roda. Servem de padrao pra que a lista chegue pronta em qualquer
 * aparelho — o apelido salvo no navegador continua tendo prioridade,
 * entao da pra corrigir qualquer um sem mexer no codigo.
 */
export const EFFECT_NAMES: readonly string[] = [
  'Vermelho com branco movendo',
  'Vermelho com cores movendo',
  'Vermelho com cores movendo (inverso)',
  'Verde com branco movendo',
  'Vermelho com cores movendo',
  'Azul forte com cores movendo (inverso)',
  'Azul forte com cores movendo (inverso)',
  'Amarelo com cores movendo',
  'Amarelo com cores movendo (inverso)',
  'Azul com cores movendo',
  'Azul com cores movendo (inverso)',
  'Roxo com cores movendo',
  'Roxo com cores movendo (inverso)',
  'Branco com cores movendo',
  'Branco com cores movendo (inverso)',
  'Vermelho, branco e desligado',
  'Vermelho, branco e desligado (inverso)',
  'Verde, branco e desligado',
  'Verde, branco e desligado (inverso)',
  'Azul forte, branco e desligado',
  'Azul forte, branco e desligado (inverso)',
  'Amarelo, branco e desligado',
  'Amarelo, branco e desligado (inverso)',
  'Azul, branco e desligado',
  'Azul, branco e desligado (inverso)',
  'Rosa, branco e desligado',
  'Azul, branco e desligado (inverso)',
  'Vermelho, branco e desligado',
  'Vermelho, branco e desligado (inverso)',
  'Verde, branco e desligado',
]

/** Converte "#ff8800" em [255, 136, 0]. */
export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16)
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]
}
