import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em producao o site vive em https://<usuario>.github.io/led-rgb/, entao os
// assets precisam desse prefixo — sem ele a pagina abre em branco. No `dev`
// mantemos a raiz, que e mais comodo pra rodar local.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/led-rgb/' : '/',
  plugins: [react()],
}))
