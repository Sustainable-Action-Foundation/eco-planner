"use client"

import formSubmitter from "@/functions/formSubmitter";
import { IconMail } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export default function VerifyForm() {
	const { t } = useTranslation("pages");

	function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
		event.preventDefault()

		const form = event.target
		const emailAdress = form.email.value

		// Send a new verification email
		formSubmitter('/api/sendVerification', JSON.stringify({ email: emailAdress }), 'POST')
	}

	return (
		<form onSubmit={handleSubmit}>
			<label className="flex-grow-100">
        {/* TODO TABLER_ICONS: I18n for label */}
        E-post
				<div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
					<IconMail aria-hidden="true" style={{minWidth: '24px'}}/>
					<input className="padding-0 margin-inline-50" type="email" placeholder="email" name="email" required id="email" autoComplete="email" />
				</div>
			</label>
			<button type="submit" className="font-weight-500 margin-left-auto block" >{t("pages:verify.submit_resend")}</button>
		</form>
	)
}