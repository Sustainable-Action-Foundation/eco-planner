'use client'

import { useTranslation } from "react-i18next"
import { IconLogout2 } from "@tabler/icons-react"

export default function LogoutButton() {
  const { t } = useTranslation(["common", "components"])
  return (
    <button className="justify-content-flex-end transparent" onClick={async () => {
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
      <div className="flex-grow-100" style={{ marginLeft: "2px", textAlign: "left" }}>{t("common:tsx.logout")}</div>
      <IconLogout2 width={20} height={20} style={{ marginRight: '2px'}} aria-hidden="true" />
    </button>
  )
}