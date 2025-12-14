import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { handleOAuthCallbackIfNeeded } from './utils/oauthCallback'
import { initializeStorage } from './services/storage/initStorage'

// Bootstrap the application
async function bootstrap() {
  // Handle OAuth callback if this is a callback URL
  // This prevents mounting the full app for callback popups
  const isCallback = await handleOAuthCallbackIfNeeded()
  if (isCallback) {
    return
  }

  // Create Vue app with Pinia
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  // Initialize async storage (Wails SQLite) before mounting
  // This ensures all stores have their data loaded from SQLite
  await initializeStorage()

  // Mount the app
  app.mount('#app')
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap app:', err)
})
