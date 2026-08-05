'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import styles from './draggable.module.css';
import { IconRestore } from '@tabler/icons-react';

export default function DraggableSnapBack({ children }: { children: React.ReactNode }) {
  const landingZoneRef = useRef<HTMLDivElement | null>(null);   // the "home" drop zone (the initial area)
  const draggableContainerRef = useRef<HTMLDivElement | null>(null);    // the draggable element itself

  const [pos, setPos] = useState({ x: 0, y: 0 }); // current translate offset from home
  const [dragging, setDragging] = useState(false);
  const [isOverHome, setIsOverHome] = useState(false);

  // pointer offset between where you grabbed the thumb and the box's current x/y
  const dragOffset = useRef({ x: 0, y: 0 });

  const checkOverlapsHome = useCallback(() => {
    if (!draggableContainerRef.current || !landingZoneRef.current) return false;

    const boxRect = draggableContainerRef.current.getBoundingClientRect();
    const homeRect = landingZoneRef.current.getBoundingClientRect();

    const boxCenterX = boxRect.left + boxRect.width / 2;
    const boxCenterY = boxRect.top + boxRect.height / 2;

    return (
      boxCenterX >= homeRect.left &&
      boxCenterX <= homeRect.right &&
      boxCenterY >= homeRect.top &&
      boxCenterY <= homeRect.bottom
    );
  }, []);

  const snapBack = useCallback(() => {
    setPos({ x: 0, y: 0 });
    setDragging(false);
    setIsOverHome(false);
    if (draggableContainerRef.current) {
      draggableContainerRef.current.style.positionAnchor = '--my-anchor';
      draggableContainerRef.current.style.positionArea = 'center center';
      draggableContainerRef.current.style.top = 'unset';
      draggableContainerRef.current.style.left = 'unset';
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (draggableContainerRef.current?.style.positionAnchor === '--my-anchor' && landingZoneRef.current) {
      draggableContainerRef.current.style.positionAnchor = 'unset';
      draggableContainerRef.current.style.positionArea = 'unset';
      draggableContainerRef.current.style.top = `${landingZoneRef.current.getBoundingClientRect().top}px`;
      draggableContainerRef.current.style.left = `${landingZoneRef.current.getBoundingClientRect().left}px`;
    }
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };

    // Capture pointer so we keep receiving move/up events even if the
    // pointer leaves the thumb element.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;

    setPos({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    });
  }, [dragging]);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (checkOverlapsHome()) {
        snapBack();
      } else {
        setDragging(false);
        setIsOverHome(false);
      }
    },
    [checkOverlapsHome, snapBack],
  );

  // While dragging, continuously check whether we're hovering the home zone
  useEffect(() => {
    if (!dragging) return;
    setIsOverHome(checkOverlapsHome());
  }, [pos, dragging, checkOverlapsHome]);


  return (
    <div
      ref={landingZoneRef}
      className={`${styles['landing-zone']}`}
      style={{
        border: isOverHome ? '1px dashed var(--blue-40)' : '1px dashed var(--gray-80)',
        backgroundColor: isOverHome ? 'var(--blue-90)' : '',
      }}
    >
      <p style={{ transition: 'color .2s ease', color: isOverHome ? 'var(--blue-40)' : '' }}>Drag to snap back</p> {/* TODO: i18n */}
      <button type="button" className='flex align-items-center gap-25' onClick={snapBack} style={{ color: isOverHome ? 'var(--blue-40)' : '' }}>
        <IconRestore width={16} height={16} aria-hidden="true" style={{ minWidth: '16px' }} />
        Bring back {/* TODO: i18n */}
      </button>

      <div
        ref={draggableContainerRef}
        className={`${styles['draggable-container']}`}
        style={{
          positionAnchor: '--my-anchor',
          positionArea: 'center center',
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          boxShadow: dragging ? 'rgba(0, 0, 0, 0.1) 0px 0px 4px 1px' : 'rgba(0, 0, 0, 0.05) 0px 0px 0px 1px',
        }}
      >
        <menu
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`padding-75 margin-0 flex justify-content-center align-items-center ${styles['draggable-thumb-container']} `}
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
          <div className={`${styles['draggable-thumb']}`} style={{ backgroundColor: dragging ? 'var(--gray-70)' : 'var(--gray-90)' }}></div>
        </menu>
        {children}
      </div>
    </div>
  );
}