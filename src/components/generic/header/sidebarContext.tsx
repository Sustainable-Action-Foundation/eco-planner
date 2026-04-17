"use client"
import { createContext, useContext, useState } from "react"
import type { SetStateAction, Dispatch } from "react"

const SidebarContext = createContext<{
  width: number,
  setWidth: Dispatch<SetStateAction<number>>
}>({ width: 0, setWidth: () => { } })

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(0)
  return (
    <SidebarContext.Provider value={{ width, setWidth }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)