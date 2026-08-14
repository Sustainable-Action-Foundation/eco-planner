'use client';

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation(["common", "components"]);
  const router = useRouter();
  return (
    <button
      type="button"
      id={id}
      className={`${className}`}
      style={{ ...style }}
      data-testid="logout-button"
      onClick={() => {
        fetch('/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).then((res) => {
          if (res.ok) {
            router.push('/');
            router.refresh();
          } else {
            alert(t("components:logout_button.failed"));
          }
        }).catch((err: unknown) => {
          console.error("Logout failed:", err);
          alert(t("components:logout_button.failed"));
        });
      }}>
      {children}
    </button>
  );
}