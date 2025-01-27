import { notFound } from 'next/navigation';

export default function Page({ params }: {params: {user: string}}) {
  
  // Check if user starts with @ 
  // (%40 = @ due to URI encoding)
  if (!params.user.startsWith('%40')) {
    notFound(); // Trigger a 404 page
  }
  
  return <>
    <h1>{params.user.replace('%40', '')}</h1>
  </>
}