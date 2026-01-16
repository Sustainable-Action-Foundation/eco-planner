"use client"

import { useTranslation } from "react-i18next";
import formSubmitter from "@/functions/formSubmitter";

export default function VerifyButton() {
	const { t } = useTranslation("pages");

	function verify() {
		const params = new URLSearchParams(window.location.search)
		const email = params.get('email')
		const hash = params.get('hash')

		formSubmitter('/api/verify', JSON.stringify({ email, hash }), 'PATCH', t)
	}

	return (
		<button type="button" className="seagreen color-purewhite font-weight-bold width-100" style={{ fontSize: '1rem' }} onClick={verify}>{t("pages:verify_verify.submit")}</button>
	)
}