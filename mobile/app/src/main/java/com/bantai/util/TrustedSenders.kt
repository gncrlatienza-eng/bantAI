package com.bantai.util

/**
 * Senders BantAI treats as trusted: Philippine telcos, banks and e-wallets,
 * Google and other big apps, and government agencies -- matched by their
 * alphanumeric sender ID (never a plain phone number).
 *
 * A trusted sender is never auto-blocked (that would cut off balance, OTP,
 * bank and service notices), and its conversation shows no report/block
 * affordances or "suspicious" warnings -- only the AI summary. A scam-looking
 * text from one still raises an alert in the Alerts tab.
 *
 * This built-in list works offline; the backend's TrustedOrganization registry
 * (IngestResult.senderStatus == "verified_organization") is honoured on top of
 * it, so admins can add more organisations without an app update.
 *
 * Sender IDs can be spoofed, so this only ever relaxes what the UI shows and
 * prevents an automatic block -- it never rewrites a message's stored verdict.
 */
object TrustedSenders {
    // Banks, e-wallets and government agencies -- the senders that don't put
    // links in their texts (see SmsRiskSignals.spoofWarning).
    private val FINANCIAL =
        setOf(
            // Banks
            "BDO",
            "BPI",
            "METROBANK",
            "UNIONBANK",
            "SECURITYBANK",
            "RCBC",
            "PNB",
            "LANDBANK",
            "CHINABANK",
            "EASTWEST",
            "PSBANK",
            "AUB",
            "HSBC",
            "CITIBANK",
            "MAYBANK",
            "CIMB",
            "TONIK",
            "GOTYME",
            "SEABANK",
            // E-wallets and payments
            "GCASH",
            "MAYA",
            "PAYMAYA",
            "SHOPEEPAY",
            "GRABPAY",
            "COINSPH",
            "PALAWANPAY",
            // Government
            "SSS",
            "PAGIBIG",
            "PHILHEALTH",
            "BIR",
        )

    private val BUILT_IN =
        FINANCIAL +
            setOf(
                // Telcos and ISPs -- Globe / TM / GOMO
                "GLOBE",
                "GLOBEREWARD",
                "GLOBEREWARDS",
                "GLOBEATHOME",
                "8080",
                "TM",
                "GOMO",
                // Smart / TNT / Sun / PLDT
                "SMART",
                "SMARTREWARDS",
                "SMARTBRO",
                "TNT",
                "SUN",
                "PLDT",
                "PLDTHOME",
                // DITO, Converge
                "DITO",
                "DITOREWARDS",
                "CONVERGE",
                // Google and other big apps
                "GOOGLE",
                "APPLE",
                "MICROSOFT",
                "FACEBOOK",
                "META",
                "INSTAGRAM",
                "WHATSAPP",
                "TIKTOK",
                "VIBER",
                "TELEGRAM",
                "SHOPEE",
                "LAZADA",
                "GRAB",
                "FOODPANDA",
                "ANGKAS",
                "LALAMOVE",
                "NETFLIX",
                "SPOTIFY",
                // Government (non-financial)
                "DFA",
                "LTO",
                "PSA",
                "NDRRMC",
            )

    private val SEPARATORS = Regex("[\\s\\-_.]")

    private fun normalize(sender: String) = sender.replace(SEPARATORS, "").uppercase()

    fun isBuiltIn(sender: String): Boolean = normalize(sender) in BUILT_IN

    /** A bank, e-wallet or government agency among the built-in names. */
    fun isFinancial(sender: String): Boolean = normalize(sender) in FINANCIAL

    /** [registryStatus] is the backend's sender familiarity, when known. */
    fun isTrusted(
        sender: String,
        registryStatus: String? = null,
    ): Boolean = isBuiltIn(sender) || registryStatus == "verified_organization"
}
