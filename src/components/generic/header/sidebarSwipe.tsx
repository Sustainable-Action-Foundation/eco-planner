"use client"
import { useSidebar } from "./sidebarContext"

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const { width, setWidth } = useSidebar()

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: width > 0 ? 'auto' : 'none',
        }}
        onClick={() => setWidth(0)}
      />
      {/* Sidebar */}
      <div style={{ transform: `translateX(${width - 240}px)`, position: 'relative', zIndex: 2}}>
        {children}
      </div>
    </>
  )
}