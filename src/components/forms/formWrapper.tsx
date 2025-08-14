"use client"

import React, { useState } from "react"
import styles from "./forms.module.css"
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";

export default function FormWrapper({
  children,
}: {
  children: React.ReactNode,
}) {

  function iterateIndicators(currentTransformIndex: number) {
    const currentIndicator = document?.getElementById("current-indicator");
    const indicatorsParent = document?.getElementById("indicators");
    const indicators = Array.from(indicatorsParent?.children || []);

    // TODO - maybe more than index should be used to check if the sections are complete? A section can be complete even if it is still in view
    // Turn indicators green if they are complete
    for (let i = 0; i < indicators.length; i++) {
      if (i < currentTransformIndex) {
        (indicators[i] as HTMLElement).style.backgroundColor = "seagreen";
      } else {
        (indicators[i] as HTMLElement).style.backgroundColor = "var(--gray-90)";
      }
    }

    // Move the thin green line under the indicators to indicate which section is visible
    if (currentIndicator) {
      currentIndicator.style.transform = `translate(${(250 * currentTransformIndex) + 50}%, 0)`;
    }
  }

  const [transformIndex, setTransformIndex] = useState(0);
  const sections = React.Children.toArray(children);

  function iterateSections(options?: { reverse?: boolean }) {
    const formSlide = Array.from(document?.getElementsByClassName("fieldsetWrapper"));

    const currentTransformIndex = transformIndex + (options?.reverse ? -1 : 1);

    if (sections) {
      // If trying to slide to a non-existent section, do nothing
      if ((currentTransformIndex >= sections.length && !options?.reverse) || (currentTransformIndex < 0 && options?.reverse)) {
        return;
      }

      // Move each form element in the appropriate direction to create a sliding effect
      formSlide.forEach(element => {
        if (element instanceof HTMLElement) {
          if (options?.reverse) {
            element.style.transform = `translateX(-${(currentTransformIndex) * 100}%)`;
          } else {
            element.style.transform = `translateX(-${(currentTransformIndex) * 100}%)`;
          }
        }
      });
    }

    iterateIndicators(currentTransformIndex);
    setTransformIndex(currentTransformIndex);
  }

  // Hide the "next" button when at the final slide
  let nextButtonHiddenClass = "";
  if (transformIndex == sections.length - 1) {
    nextButtonHiddenClass = "hidden";
  }

  // Hide the "back" button when at the first slide
  let backButtonHiddenClass = "";
  if (transformIndex == 0) {
    backButtonHiddenClass = "hidden";
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

      <div className={`margin-block-start-100 padding-inline-100 gap-50 grid ${styles.indicatorLayout}`}>
        <button type="button" id="backButton" className={`flex align-items-center transparent round gap-25 ${backButtonHiddenClass} ${styles.indicatorButton}`} onClick={() => iterateSections({ reverse: true })}>
          <IconArrowLeft style={{ minWidth: '24px' }} aria-hidden="true" />
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

        <button type="button" id="nextButton" className={`flex align-items-center transparent round gap-25 margin-left-auto ${nextButtonHiddenClass} ${styles.indicatorButton}`} onClick={() => iterateSections()}>
          Nästa
          <IconArrowRight style={{ minWidth: '24px' }} aria-hidden="true" />
        </button>
      </div>

    </>
  )
}