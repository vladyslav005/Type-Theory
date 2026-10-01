import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import {i18nReady} from './i18n'
import App from './app/App.tsx'

// Waits for a lazily loaded locale so non-English visitors don't see an English flash.
void i18nReady.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
