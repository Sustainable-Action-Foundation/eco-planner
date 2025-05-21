"use client"

import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import { useTranslation } from "react-i18next";

export default function VerifyForm() {
  const { t } = useTranslation();

	function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
		event.preventDefault()

		const form = event.target
		const emailAdress = form.email.value

		// Send a new verification email
		formSubmitter('/api/sendVerification', JSON.stringify({ email: emailAdress }), 'POST')
	}

	return (
		<form onSubmit={handleSubmit} className="flex gap-50 flex-wrap-wrap align-items-center">
			<label className="flex-grow-100">
				<div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
					<Image src="/icons/email.svg" alt="" width={24} height={24} />
					<input className="padding-0 margin-inline-50" type="email" placeholder="email" name="email" required id="email" autoComplete="email" />
				</div>
			</label>
			<button type="submit" className="font-weight-500" style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}>{t("pages:verify.submit_resend")}</button>
		</form>
	)
}