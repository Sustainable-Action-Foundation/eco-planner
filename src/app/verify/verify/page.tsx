'use client';

import formSubmitter from "@/functions/formSubmitter";

export default function Page() {
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
          <h1 className="padding-bottom-100" style={{borderBottom: '1px solid var(--gray)'}}>Verifiera din e-post</h1>
          <p>Verifiera din e-post genom att klicka på knappen nedan.</p>
          <button type="button" className="seagreen color-purewhite font-weight-bold width-100" style={{fontSize: '1rem'}}  onClick={verify}>Verifiera min e-post</button>
        </div>
      </main>
    </>
  )
}