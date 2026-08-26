# Fita LED

PWA para controlar fitas LED RGB com controlador BLE da família ELK
(`ELK-BLEDOM`, `MELK-OA10`, `MELK-OB…`, `LEDBLE`) direto do navegador,
via Web Bluetooth. Sem backend, sem app store, sem custo.

**Só funciona no Chrome no Android** (ou Chromium no desktop). O iOS não
implementa Web Bluetooth em navegador nenhum — todos são obrigados a usar
o motor do Safari.

## Rodando local

```bash
npm install
npm run dev
```

Web Bluetooth exige contexto seguro: `localhost` funciona, `http://` num IP
da rede não. Pra testar no celular durante o desenvolvimento, use o site
publicado (é HTTPS) em vez de `--host`.

## Publicando no GitHub Pages

O deploy é automático via GitHub Actions a cada push na `main`. Configuração
única, no GitHub:

1. Crie o repositório com o nome **`led-rgb`** (o `base` do Vite depende
   disso — outro nome exige mudar `vite.config.ts` e o `manifest.webmanifest`).
2. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions**.
3. `git push`. O site sai em `https://<usuario>.github.io/led-rgb/`.

No celular, abra essa URL no Chrome e use **⋮ → Adicionar à tela inicial**:
vira um ícone que abre em tela cheia, sem barra de navegador.

## Estrutura

```
src/
├── protocol/elk.ts   funções puras: valores → bytes. Não conhece Bluetooth.
├── ble.ts            conectar, escrever, reconectar. Não conhece o protocolo.
└── App.tsx           a interface.
```

Essa separação é de propósito: se o seu controlador for uma variante que
responde diferente, `protocol/elk.ts` é o único arquivo que muda. Pra
suportar uma fita de outra marca, basta um segundo módulo de protocolo.

## Se a fita não responder

O protocolo aqui é o ELK-BLEDOM clássico, que cobre a maior parte da família.
Se o seu controlador for uma revisão diferente, confirme com o app
**nRF Connect** (grátis, Android):

1. Conecte no dispositivo e procure o service `0000fff0-…`.
2. Dentro dele, a característica `0000fff3-…` deve estar marcada como
   **WRITE** ou **WRITE NO RESPONSE**.
3. Escreva `7E0005 03FF0000 00EF` nela. A fita deve ficar vermelha.

Se o UUID for outro, ajuste `SERVICE_UUID` / `WRITE_UUID` em
`src/protocol/elk.ts`. Se os UUIDs baterem mas o comando de liga/desliga não
funcionar, existe uma variante conhecida — troque o payload de `power()` por
`[0x04, on ? 0x01 : 0x00, 0x00, 0x00, 0x00]`.

## Protocolo

Pacotes de 9 bytes, sempre `7E … EF`:

| Comando | Bytes |
|---|---|
| Cor | `7E 00 05 03 RR GG BB 00 EF` |
| Ligar | `7E 00 04 F0 00 01 FF 00 EF` |
| Desligar | `7E 00 04 00 00 00 FF 00 EF` |
| Brilho (0–100) | `7E 00 01 XX 00 00 00 00 EF` |
| Velocidade (0–100) | `7E 00 02 XX 00 00 00 00 EF` |
| Efeito (0x80–0x9D) | `7E 00 03 XX 03 00 00 00 EF` |
