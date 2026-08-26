/**
 * Camada Bluetooth. Sabe conectar, escrever e reconectar — e nada
 * sobre o significado dos bytes que carrega.
 */
import { SERVICE_UUID, WRITE_UUID, NAME_PREFIXES, type Packet } from './protocol/elk'

export type Status = 'idle' | 'connecting' | 'connected' | 'disconnected'

/** Web Bluetooth so existe em contexto seguro (https ou localhost). */
export function isSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

export class LedStrip {
  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null

  /** Escritas sao enfileiradas: o GATT rejeita operacoes concorrentes. */
  private queue: Promise<void> = Promise.resolve()

  onStatusChange: (status: Status) => void = () => {}

  get name(): string {
    return this.device?.name ?? 'desconhecido'
  }

  get connected(): boolean {
    return !!this.device?.gatt?.connected && !!this.characteristic
  }

  /**
   * Abre o seletor de dispositivos do Chrome e conecta no escolhido.
   * Precisa ser chamado a partir de um gesto do usuario (clique).
   *
   * @param anyDevice lista todo dispositivo BLE por perto, e nao so os
   *   de nome conhecido. Util se a sua fita anunciar um nome fora do padrao.
   */
  async connect(anyDevice = false): Promise<void> {
    if (!isSupported()) {
      throw new Error('Este navegador não suporta Web Bluetooth. Use o Chrome no Android.')
    }

    this.onStatusChange('connecting')
    try {
      this.device = await navigator.bluetooth.requestDevice(
        anyDevice
          ? { acceptAllDevices: true, optionalServices: [SERVICE_UUID] }
          : {
              filters: NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
              optionalServices: [SERVICE_UUID],
            },
      )

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect)
      await this.openGatt()
      this.onStatusChange('connected')
    } catch (err) {
      this.onStatusChange('idle')
      throw err
    }
  }

  private async openGatt(): Promise<void> {
    const server = await this.device!.gatt!.connect()
    const service = await server.getPrimaryService(SERVICE_UUID)
    this.characteristic = await service.getCharacteristic(WRITE_UUID)
  }

  private handleDisconnect = () => {
    this.characteristic = null
    this.onStatusChange('disconnected')
  }

  /**
   * Reconecta no mesmo dispositivo, sem passar pelo seletor de novo.
   * So funciona enquanto a pagina nao recarregou.
   */
  async reconnect(): Promise<void> {
    if (!this.device) throw new Error('Nenhum dispositivo para reconectar.')
    this.onStatusChange('connecting')
    try {
      await this.openGatt()
      this.onStatusChange('connected')
    } catch (err) {
      this.onStatusChange('disconnected')
      throw err
    }
  }

  disconnect(): void {
    this.device?.gatt?.disconnect()
  }

  /** Enfileira um pacote. Escritas saem sempre em ordem, uma por vez. */
  send(bytes: Packet): Promise<void> {
    this.queue = this.queue.then(async () => {
      if (!this.characteristic) return
      try {
        await this.characteristic.writeValueWithoutResponse(bytes)
      } catch {
        // Um pacote perdido nao justifica derrubar a fila — o proximo
        // comando (uma cor, um brilho) corrige o estado de qualquer jeito.
      }
    })
    return this.queue
  }
}
