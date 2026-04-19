import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { CURRENT_PROJECT } from '../config/projectConfig'
import type { ProjectConfig } from '../config/projectConfig'

interface ProjectContextValue {
  project: ProjectConfig
  setProject: (p: ProjectConfig) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectConfig>(CURRENT_PROJECT)
  return (
    <ProjectContext.Provider value={{ project, setProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}
