import VerifyButton from "@/components/forms/verify/verifyButton";

export default function Page() {
  return (
    <main> 
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{border: '1px solid var(--gray)'}}>
        <h1 className="padding-bottom-100" style={{borderBottom: '1px solid var(--gray)'}}>Verifiera din e-post</h1>
        <p>Verifiera din e-post genom att klicka på knappen nedan.</p>
        <VerifyButton />
      </div>
    </main>
  )
}