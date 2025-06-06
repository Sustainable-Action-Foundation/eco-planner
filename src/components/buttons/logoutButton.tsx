'use client'

import Image from "next/image"
import { useTranslation } from "react-i18next"

export default function LogoutButton() {
  const { t } = useTranslation(["common", "components"])
  return (
    <button className="flex align-items-center rounded transparent padding-50 gap-50 width-100 font-weight-500" style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden' }} onClick={async () => {
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
      <Image src="/icons/logout.svg" alt="" width="24" height="24" />
      {t("common:tsx.logout")}
    </button>
  )
}