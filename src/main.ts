import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { handleOAuthCallbackIfNeeded } from './utils/oauthCallback'

// Handle OAuth callback if this is a callback URL
// This prevents mounting the full app for callback popups
handleOAuthCallbackIfNeeded().then((isCallback) => {
  if (!isCallback) {
    // Not a callback - mount the main app
    const app = createApp(App)
    const pinia = createPinia()

    app.use(pinia)
    app.mount('#app')
  }
})
