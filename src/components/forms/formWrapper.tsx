'use client'

import { useState } from 'react'
import styles from './forms.module.css'
import Image from 'next/image'
import React from 'react'

export default function FormWrapper({
  children,
}: {
  children: React.ReactNode,
}) {

  function iterateIndicators(currentTransformIndex: number) {
    const currentIndicator = document?.getElementById('current-indicator')
    const indicatorsParent = document?.getElementById('indicators')
    const indicators = Array.from(indicatorsParent?.children || [])

    // Turn indicators green if they are complete
    for (let i = 0; i < indicators.length; i++) {
      if (i < currentTransformIndex) {
        (indicators[i] as HTMLElement).style.backgroundColor = 'seagreen'
      } else {
        (indicators[i] as HTMLElement).style.backgroundColor = 'var(--gray-90)'
      }
    }

    if (currentIndicator) {
      currentIndicator.style.transform = `translate(${(250 * currentTransformIndex) + 50}%, 0)`
    }
  }

  function enableSubmitButton(currentTransformIndex: number) {
    const submitButton = document?.getElementById('submit-button')

    if (submitButton) {
      if (currentTransformIndex == sections.length - 1) {
        submitButton.removeAttribute('disabled')
      } else {
        submitButton.setAttribute('disabled', 'true')
      }
    }
  }

  const [transformIndex, setTransformIndex] = useState(0)
  const sections = React.Children.toArray(children)

  function iterateSections(options?: { reverse?: boolean }) {
    const formSlide = Array.prototype.slice.call(document?.getElementsByClassName('fieldsetWrapper'))

    const currentTransformIndex = transformIndex + (options?.reverse ? -1 : 1)

    if (sections) {
      if ((currentTransformIndex >= sections.length && !options?.reverse) || (currentTransformIndex < 0 && options?.reverse)) {
        return
      }

      formSlide.forEach(element => {
        if (element) {
          if (options?.reverse) {
            element.style.transform = `translateX(-${(currentTransformIndex) * 100}%)`
          } else {
            element.style.transform = `translateX(-${(currentTransformIndex) * 100}%)`
          }
        }
      }
      )
    }


    iterateIndicators(currentTransformIndex)
    enableSubmitButton(currentTransformIndex)
    setTransformIndex(currentTransformIndex)

  }

  return (
    <>
      <div className={styles.formSlider}>
        {React.Children.map(children, (child, index) => (
          <div className={`${styles.formSlide} fieldsetWrapper`} key={index}>
            {child}
          </div>
        ))}
      </div>

      <div className={`margin-block-100 padding-inline-100 gap-50 grid ${styles.indicatorLayout}`}>
        <button type="button" className={`flex align-items-center transparent round gap-25 ${styles.indicatorButton}`} onClick={() => iterateSections({ reverse: true })}>
          <Image src="/icons/arrowLeft.svg" alt="" width={24} height={24} />
          Tillbaka
        </button>

        <div className={`margin-block-50 ${styles.indicatorWrapper}`}>
          <div id="indicators" className="display-flex justify-content-center gap-75 margin-block-50">
            {sections.map((_section, index) => (
              <div className={styles.indicator} key={index}></div>
            ))}
          </div>
          <div className={styles.currentIndicator} id="current-indicator"></div>
        </div>

        <button type="button" className={`flex align-items-center transparent round gap-25 margin-left-auto ${styles.indicatorButton}`} onClick={() => iterateSections()}>
          Nästa
          <Image src="/icons/arrowRight.svg" alt="" width={24} height={24} />
        </button>
      </div>

    </>
  )
}