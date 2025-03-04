'use client';

import formSubmitter from "@/functions/formSubmitter";
import { createDict } from "../verify.dict.ts";
import { useContext } from "react";
import { LocaleContext } from "@/app/context/localeContext.tsx";

export default function Page() {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).verify.page;

  function verify() {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email')
    const hash = params.get('hash')

    formSubmitter('/api/verify', JSON.stringify({ email, hash }), 'PATCH')
  }

  return (
    <>
      <main> 
        <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{border: '1px solid var(--gray)'}}>
          <h1 className="padding-bottom-100" style={{borderBottom: '1px solid var(--gray)'}}>{dict.verifyYourEmail}</h1>
          <p>{dict.verifyEmailByClicking}</p>
          <button type="button" className="seagreen color-purewhite font-weight-bold width-100" style={{fontSize: '1rem'}}  onClick={verify}>{dict.verifyMyEmail}</button>
        </div>
      </main>
    </>
  )
}