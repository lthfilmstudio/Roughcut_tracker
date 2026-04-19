import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ProjectProvider } from './contexts/ProjectContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectProvider>
      <img
        className="print-watermark"
        src={`${import.meta.env.BASE_URL}logo-print.png`}
        alt=""
        aria-hidden="true"
      />
      <App />
    </ProjectProvider>
  </StrictMode>,
)
