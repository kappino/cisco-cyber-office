import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { StoryGame } from './components/StoryGame'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoryGame />
  </StrictMode>,
)
