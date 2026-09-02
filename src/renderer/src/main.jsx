import './styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import WorkitemDetailWindow from './views/WorkitemDetailWindow'
import ErrorBoundary from './components/ErrorBoundary'

const workitemId = new URLSearchParams(window.location.search).get('workitemDetail')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {workitemId ? <WorkitemDetailWindow workitemId={workitemId} /> : <App />}
    </ErrorBoundary>
  </StrictMode>
)
