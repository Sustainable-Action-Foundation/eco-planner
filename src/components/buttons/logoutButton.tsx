'use client'

import Image from "next/image"
import { useTranslation } from "react-i18next"

export default function LogoutButton() {
  const { t } = useTranslation()
  return (
    <button className="flex align-items-center rounded transparent padding-50 gap-50 width-100 font-weight-500" style={{ fontSize: '1rem', whiteSpace: 'nowrap' }} onClick={async () => {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then((res) => {
        if (res.ok) {
          window.location.href = '/'
        } else {
          alert('Logout failed.')
        }
      })
    }}>
      <Image src="/icons/logout.svg" alt="" width="24" height="24" />
      {t("components:logout")}
    </button>
  )
}