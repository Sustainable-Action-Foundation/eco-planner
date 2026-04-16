"use client"

import { useRef, useState } from "react"

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(0)
  const [transitioning, setTransitioning] = useState(false)

  const touchXRef = useRef(0)
  const sidebarWidth = 165

  const handleTouchStart = (e: React.TouchEvent) => {
    touchXRef.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const newX = e.touches[0].clientX
    setWidth(prev => Math.min(Math.max(prev + (newX - touchXRef.current), 0), sidebarWidth))
    touchXRef.current = newX
  }

  const handleTouchEnd = () => {
    setWidth(width > sidebarWidth / 2 ? sidebarWidth : 0)
    setTransitioning(true)
    setTimeout(() => setTransitioning(false), 400)
  }

  return (
    <>
      {/* Full-screen swipe layer */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 0, touchAction: 'pan-y' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <div
        className={`${transitioning ? 'sidebar-transitioning' : ''}`}
        style={{ transform: `translateX(${width - sidebarWidth}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </>
  )
}