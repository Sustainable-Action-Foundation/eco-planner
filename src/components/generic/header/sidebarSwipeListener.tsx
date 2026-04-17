// components/SidebarSwipeListener.tsx
"use client"
import { useEffect, useRef } from "react"
import { useSidebar } from "./sidebarContext"

export default function SidebarSwipeListener() {
  const { width, setWidth } = useSidebar()
  const touchXRef = useRef(0)
  const touchYRef = useRef(0)
  const isSwipingRef = useRef<boolean | null>(null)
  const widthRef = useRef(width)

  const maxWidth = 240

  // Keep widthRef in sync so event listeners always see current value
  useEffect(() => { widthRef.current = width }, [width])

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      touchXRef.current = e.touches[0].clientX
      touchYRef.current = e.touches[0].clientY
      isSwipingRef.current = null
    }

    const onTouchMove = (e: TouchEvent) => {
      const newX = e.touches[0].clientX

      setWidth(prev => Math.min(Math.max(prev + (newX - touchXRef.current), 0), maxWidth))
      touchXRef.current = newX
    }

    const onTouchEnd = () => {
      setWidth(widthRef.current > maxWidth / 2 ? maxWidth : 0)
    }

    document.body.addEventListener("touchstart", onTouchStart)
    document.body.addEventListener("touchmove", onTouchMove)
    document.body.addEventListener("touchend", onTouchEnd)

    // return () => {
    //   document.body.removeEventListener("touchstart", onTouchStart)
    //   document.body.removeEventListener("touchmove", onTouchMove)
    //   document.body.removeEventListener("touchend", onTouchEnd)
    // }
  })

  return null // no UI
}