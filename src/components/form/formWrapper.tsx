"use client";

import { useTranslation } from "react-i18next";
import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./forms.module.css";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";

export default function FormWrapper({
  children,
  section,
  labels,
}: {
  children: React.ReactNode,
  /**
   * Section to show. The wrapper still navigates on its own with the back/next
   * buttons; this only jumps whenever the value changes, e.g. to skip past a
   * section that was filled in programmatically.
   */
  section?: number,
  /** Overrides for the navigation button texts, e.g. "Change table" instead of "Back". */
  labels?: { back?: string, next?: string },
}) {
  const { t } = useTranslation("common");

  const [transformIndex, setTransformIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const indicatorsRef = useRef<HTMLDivElement | null>(null);
  const currentIndicatorRef = useRef<HTMLDivElement | null>(null);
  const sections = React.Children.toArray(children);
  const sectionCount = sections.length;

  // Everything is looked up through refs rather than document-wide ids/classes,
  // since several wrappers can be mounted at once (e.g. one query builder dialog
  // per external variable) and must not move each other's slides.
  const goToSection = useCallback((index: number, options?: { scroll?: boolean }) => {
    if (index < 0 || index >= sectionCount) return;

    // Move each slide to bring the requested one into view
    Array.from(sliderRef.current?.children ?? []).forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.transform = `translateX(-${index * 100}%)`;
      }
    });

    // TODO - maybe more than index should be used to check if the sections are complete? A section can be complete even if it is still in view
    // Turn indicators green if they are complete
    Array.from(indicatorsRef.current?.children ?? []).forEach((indicator, i) => {
      if (indicator instanceof HTMLElement) {
        indicator.style.backgroundColor = i < index ? "seagreen" : "var(--gray-90)";
      }
    });

    // Move the thin green line under the indicators to indicate which section is visible
    if (currentIndicatorRef.current) {
      currentIndicatorRef.current.style.transform = `translate(${(250 * index) + 50}%, 0)`;
    }

    setTransformIndex(index);

    // On user navigation, scroll the nearest scrollable ancestor back to the top so
    // the new section starts in view; otherwise fields at the top (often required
    // ones) can be missed. Never the page itself: a programmatic jump can happen
    // while the wrapper sits in a closed dialog, and yanking the page around then
    // would be rude.
    if (!options?.scroll) return;
    let scrollParent: HTMLElement | null = sliderRef.current?.parentElement ?? null;
    while (scrollParent && scrollParent !== document.body && scrollParent.scrollHeight <= scrollParent.clientHeight) {
      scrollParent = scrollParent.parentElement;
    }
    if (scrollParent && scrollParent !== document.body) scrollParent.scrollTo({ top: 0 });
  }, [sectionCount]);

  useEffect(() => {
    if (section !== undefined) goToSection(section);
  }, [section, goToSection]);

  // Hide the "next" button when at the final slide
  let nextButtonHiddenClass = "";
  if (transformIndex === sectionCount - 1) {
    nextButtonHiddenClass = "hidden";
  }

  // Hide the "back" button when at the first slide
  let backButtonHiddenClass = "";
  if (transformIndex === 0) {
    backButtonHiddenClass = "hidden";
  }

  return (
    <>
      <div className={styles.formSlider} ref={sliderRef}>
        {/* Map the filtered array, not `children`: Children.map still yields a slide for a null child */}
        {sections.map((child, index) => (
          <div className={`${styles.formSlide} fieldsetWrapper`} key={index}>
            {child}
          </div>
        ))}
      </div>

      <div className={`margin-block-start-100 gap-50 grid ${styles.indicatorLayout}`}>
        <button type="button" id="backButton" className={`flex align-items-center transparent round gap-25 ${backButtonHiddenClass} ${styles.indicatorButton}`} onClick={() => goToSection(transformIndex - 1, { scroll: true })}>
          <IconArrowLeft style={{ minWidth: '24px' }} aria-hidden="true" />
          {labels?.back ?? t("common:back")}
        </button>

        <div className={`margin-block-50 ${styles.indicatorWrapper}`}>
          <div ref={indicatorsRef} className="display-flex justify-content-center gap-75 margin-block-50">
            {sections.map((_section, index) => (
              <div className={styles.indicator} key={index}></div>
            ))}
          </div>
          <div className={styles.currentIndicator} ref={currentIndicatorRef}></div>
        </div>

        <button type="button" id="nextButton" className={`flex align-items-center transparent round gap-25 margin-left-auto ${nextButtonHiddenClass} ${styles.indicatorButton}`} onClick={() => goToSection(transformIndex + 1, { scroll: true })}>
          {labels?.next ?? t("common:next")}
          <IconArrowRight style={{ minWidth: '24px' }} aria-hidden="true" />
        </button>
      </div>

    </>
  );
}
