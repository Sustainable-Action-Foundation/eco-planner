"use client"

import formSubmitter from "@/functions/formSubmitter";

// TODO: make sure this actually works
export default function VerifyButton() {
	function verify() {
		const params = new URLSearchParams(window.location.search)
		const email = params.get('email')
		const hash = params.get('hash')

		formSubmitter('/api/verify', JSON.stringify({ email, hash }), 'PATCH')
	}

	return (
		<button type="button" className="seagreen color-purewhite font-weight-bold width-100" style={{ fontSize: '1rem' }} onClick={verify}>Verifiera min e-post</button>
	)
}