'use client'

import { useTranslation } from "react-i18next"

export default function LogoutButton({
  id,
  className,
  style,
  children,
}: {
  id?: string,
  className?: string,
  style?: React.CSSProperties,
  children?: React.ReactNode,
}) {
  const { t } = useTranslation(["common", "components"])
  return (
    <button       
      id={id}
      className={`${className}`}
      style={{ ...style }}
      onClick={async () => {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then((res) => {
        if (res.ok) {
          window.location.href = '/'
        } else {
          alert(t("components:logout_button.failed"))
        }
      })
    }}>
      {children}
    </button>
  )
}