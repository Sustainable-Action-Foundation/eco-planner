'use client';

import { useToast } from "@/components/generic/toast/toastContext.use";
import { IconBrush } from "@tabler/icons-react";

/**
 * The sidebar's create button for logged-in users who cannot create content
 * anywhere (no non-guest org membership): visually disabled, but still
 * clickable so it can explain itself with a toast.
 */
export default function DisabledCreateButton({ label, hint }: { label: string, hint: string }) {
  const { addToast } = useToast();

  return (
    <button
      type="button"
      aria-disabled={true}
      title={hint}
      onClick={() => addToast(hint, "warning")}
      className='transparent rounded'
      style={{ fontSize: '1rem', opacity: 0.5, cursor: 'not-allowed' }}
      data-testid='create-button-disabled'
    >
      <IconBrush aria-hidden="true" />
      {label}
    </button>
  );
}
