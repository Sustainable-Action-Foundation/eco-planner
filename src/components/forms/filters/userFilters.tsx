"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useContext, useTransition } from "react";
import parentDict from "../forms.dict.json" with { type: "json" };
import { LocaleContext } from "@/app/context/localeContext";

// TODO - translate this page
export default function UserFilters({
    userPage
  }: {
    userPage: boolean
  }) {
    const dict = parentDict.filters.userFilters;
    const locale = useContext(LocaleContext);

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
        <legend className='font-weight-500 padding-bottom-75'>{dict.posts[locale]}</legend>
        <label className='flex gap-25 align-items-center'>
          <input type='checkbox' value='roadmap' defaultChecked={searchParams.getAll('objects').includes('roadmap')} onChange={(e) => {
              if (e.target.checked) {
                updateArrayParam('objects', e.target.value)
              } else {
                updateArrayParam('objects', e.target.value, true)
              }
            }} 
          />
          {dict.roadmap[locale]}
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
          {dict.roadmapSeries[locale]}
        </label>
      </fieldset>

      {userPage === true ? 
        <fieldset className='flex gap-100 fieldset-unset-pseudo-class'>
          <legend className='font-weight-500 padding-bottom-75'>{dict.clearance[locale]}</legend>
          <label className='flex gap-25 align-items-center'>
            <input type='checkbox' value='edit' defaultChecked={searchParams.getAll('access').includes('edit')} onChange={(e) => {
                if (e.target.checked) {
                  updateArrayParam('access', e.target.value)
                } else {
                  updateArrayParam('access', e.target.value, true)
                }
              }} 
            />
            {dict.editingPrivileges[locale]} 
          </label>
        </fieldset>
      : null}
    </menu>
  )

}