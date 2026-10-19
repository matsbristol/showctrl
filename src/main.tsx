/* Entry point. See app/Root.tsx for how the new and old apps are split. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Root } from './app/Root'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
