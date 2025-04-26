import VerifyForm from "@/components/forms/verify/verifyForm";
import { buildMetadata } from "@/functions/buildMetadata";

export async function generateMetadata() {
  return buildMetadata({ 
    title: 'Verifiera din e-post',
    description: undefined,  
    og_url: '/verify'
  })  
}

export default function Page() {
  return (
    <main>
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{border: '1px solid var(--gray)'}}>
        <h1 className="padding-bottom-100" style={{borderBottom: '1px solid var(--gray)'}}>Verifiera din e-post</h1>
        <p>Ett mejl har skickats till din e-postadress. Verifiera din e-post genom att följa instruktionerna i mejlet.</p>
        <h2 className="margin-top-200 margin-bottom-50" style={{fontSize: '1.25rem'}}>Har du inte fått något mejl?</h2>
        <p className="margin-top-0">Kolla i din skräppost eller fyll i din e-postadress nedan och klicka på knappen för att få ett nytt mejl.</p>
        <VerifyForm />
      </div>
    </main>
  )
}