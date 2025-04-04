'use client';

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function UserFilters({
    userPage
  }: {
    userPage: boolean
  }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [_isPending, startTransition] = useTransition();

  function updateArrayParam(key: string, value: string, remove?: boolean) {
    const newParams = new URLSearchParams(searchParams);

    if (remove) {
      newParams.delete(key, value);
    } else {
      newParams.append(key, value);
    }

    startTransition(() => {
      router.replace(`${pathname}?${newParams.toString()}`)
    })
  }

  return (
    <menu className='margin-0 padding-0 flex gap-300 flex-wrap-wrap margin-bottom-100'>
      <fieldset className='flex gap-100 fieldset-unset-pseudo-class'>
        <legend className='font-weight-500 padding-bottom-75'>Inlägg</legend>
        <label className='flex gap-25 align-items-center'>
          <input type='checkbox' value='roadmap' defaultChecked={searchParams.getAll('objects').includes('roadmap')} onChange={(e) => {
              if (e.target.checked) {
                updateArrayParam('objects', e.target.value)
              } else {
                updateArrayParam('objects', e.target.value, true)
              }
            }} 
          />
          Färdplan
        </label>
        <label className='flex gap-25 align-items-center'>
          <input type='checkbox' value='roadmapseries' defaultChecked={searchParams.getAll('objects').includes('roadmapseries')} onChange={(e) => {
              if (e.target.checked) {
                updateArrayParam('objects', e.target.value)
              } else {
                updateArrayParam('objects', e.target.value, true)
              }
            }} 
          />
          Färdplansserie
        </label>
      </fieldset>

      {userPage === true ? 
        <fieldset className='flex gap-100 fieldset-unset-pseudo-class'>
          <legend className='font-weight-500 padding-bottom-75'>Behörighet</legend>
          <label className='flex gap-25 align-items-center'>
            <input type='checkbox' value='edit' defaultChecked={searchParams.getAll('access').includes('edit')} onChange={(e) => {
                if (e.target.checked) {
                  updateArrayParam('access', e.target.value)
                } else {
                  updateArrayParam('access', e.target.value, true)
                }
              }} 
            />
            Redigeringsbehörighet 
          </label>
        </fieldset>
      : null}
    </menu>
  )

}