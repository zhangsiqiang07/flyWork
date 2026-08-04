import './styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import WorkitemDetailWindow from './views/WorkitemDetailWindow'

const workitemId = new URLSearchParams(window.location.search).get('workitemDetail')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {workitemId ? <WorkitemDetailWindow workitemId={workitemId} /> : <App />}
  </StrictMode>
)
