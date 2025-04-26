import VerifyButton from "@/components/forms/verify/verifyButton";
import { buildMetadata } from "@/functions/buildMetadata";

export async function generateMetadata() {
  return buildMetadata({ 
    title: 'Slutför verifiering',
    description: undefined,  
    og_url: '/verify/verify'
  })  
}

export default function Page() {
  return (
    <main> 
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{border: '1px solid var(--gray)'}}>
        <h1 className="padding-bottom-100" style={{borderBottom: '1px solid var(--gray)'}}>Slutför verifiering av e-post</h1>
        <p>Slutför verifiering av din e-post genom att klicka på knappen nedan.</p>
        <VerifyButton />
      </div>
    </main>
  )
}