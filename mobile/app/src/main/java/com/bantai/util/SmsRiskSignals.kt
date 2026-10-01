package com.bantai.util

/**
 * Offline smishing signals, used only when the backend model can't be reached.
 *
 * A lure phrase alone ("congratulations", "claim your", "prize") is routine in
 * legitimate PH telco, e-wallet, and retail texts -- on a real inbox the old
 * keyword-only rule flagged ~6% of messages from GLOBE, GCash, DITO, 8080 and
 * GLOBEREWARD. A message is suspicious only when the lure or account-threat
 * wording is paired with a link that isn't the brand's own, or when a link's
 * registered domain impersonates a brand.
 */
object SmsRiskSignals {
    private val LURE_PHRASES =
        listOf(
            "you have won",
            "you won",
            "you are selected",
            "cash prize",
            "claim now",
            "tap to claim",
            "winner",
            "prize",
            "congratulations",
            "claim your",
            "free gift",
            "nanalo",
            "panalo",
            "i-claim",
        )

    private val ACCOUNT_THREAT_PHRASES =
        listOf(
            "verify your account",
            "confirm your account",
            "account suspended",
            "account has been suspended",
            "unauthorized access",
            "immediately click",
            "account will be",
            "update your account",
            "account is locked",
            "account has been locked",
            "click here",
            "tap here",
        )

    // Official domains of PH brands commonly impersonated over SMS, mirroring
    // ai/service/indicator_tags.py's _OFFICIAL_DOMAINS plus link domains seen
    // in real telco traffic (glbe.co, app.dito.ph, go.gcash.com).
    private val OFFICIAL_DOMAINS =
        listOf(
            "gcash.com",
            "globe.com.ph",
            "glbe.co",
            "glbeshop.co",
            "dito.ph",
            "smart.com.ph",
            "smrt.ph",
            "tnt.ph",
            "bpi.com.ph",
            "bdo.com.ph",
            "landbank.com",
            "metrobank.com.ph",
            "unionbankph.com",
            "securitybank.com",
            "rcbc.com",
            "pnb.com.ph",
            "maya.ph",
            "paymaya.com",
            "mayaph.co",
            "gotyme.com.ph",
            "seabank.ph",
            "lazada.com.ph",
            "lzd.co",
            "shopee.ph",
            "shp.ee",
            "lbcexpress.com",
            "jtexpress.ph",
            "grab.com",
            "foodpanda.ph",
            "meralco.com.ph",
            "sss.gov.ph",
            "philhealth.gov.ph",
            "pagibigfund.gov.ph",
            "bir.gov.ph",
            "lto.gov.ph",
        )

    // Brand names that a lookalike registered domain (gcash-claim.com,
    // bdo-secure.xyz) would carry. Checked against the registered domain only,
    // so deep-link services like globeone.onelink.me don't count.
    private val BRAND_TOKENS =
        listOf(
            "gcash",
            "globe",
            "smart",
            "dito",
            "maya",
            "bdo",
            "bpi",
            "landbank",
            "metrobank",
            "unionbank",
            "securitybank",
            "rcbc",
            "gotyme",
            "seabank",
            "shopee",
            "lazada",
            "lbc",
            "jtexpress",
            "meralco",
            "sss",
            "philhealth",
            "pagibig",
        )

    private val SHORTENERS =
        setOf("bit.ly", "tinyurl.com", "is.gd", "cutt.ly", "t.ly", "rb.gy", "tiny.cc", "s.id", "shorturl.at")

    private val RISKY_TLDS =
        setOf(
            "xyz",
            "info",
            "tk",
            "top",
            "site",
            "online",
            "click",
            "link",
            "live",
            "shop",
            "cc",
            "icu",
            "buzz",
            "vip",
            "cyou",
            "sbs",
            "lol",
            "example",
        )

    private val KNOWN_TLDS =
        RISKY_TLDS + setOf("com", "net", "org", "ph", "co", "ly", "ee", "gd", "at", "id", "me", "io", "app", "gl")
    private const val PH_SECOND_LEVEL_LABELS = 3
    private const val REGISTERED_DOMAIN_LABELS = 2
    private val PH_SECOND_LEVEL_DOMAINS = setOf("com", "gov", "net", "org", "edu")

    private val HOST_REGEX = Regex("(?:https?://)?((?:[a-z0-9][a-z0-9-]*\\.)+[a-z]{2,})")

    @Suppress("ReturnCount") // early returns for the cheap checks before the link scan
    fun looksSuspicious(body: String): Boolean {
        val text = body.lowercase()
        val hosts = linkHosts(text)
        if (hosts.isEmpty()) return false
        if (hosts.any(::isLookalike)) return true
        val hasLure = LURE_PHRASES.any { text.contains(it) }
        val hasAccountThreat = ACCOUNT_THREAT_PHRASES.any { text.contains(it) }
        return (hasAccountThreat && hosts.any { !isOfficial(it) }) || (hasLure && hosts.any(::isRisky))
    }

    // Asking the user to hand over a code -- never the "never share your OTP"
    // warning genuine OTP texts carry.
    private val OTP_REQUEST_PHRASES =
        listOf(
            "send your otp",
            "send us your otp",
            "send the otp",
            "reply with your otp",
            "reply with the otp",
            "reply your otp",
            "give your otp",
            "give us your otp",
            "provide your otp",
            "provide the otp",
            "share your otp with us",
            "send the code",
            "reply with the code",
            "ibigay ang otp",
            "ibigay mo ang otp",
            "i-reply ang otp",
            "ipadala ang otp",
        )

    // Asking for a PIN, password or card details -- no bank, e-wallet or telco
    // ever does this by text.
    private val CREDENTIAL_REQUEST_PHRASES =
        listOf(
            "your mpin",
            "your pin",
            "your password",
            "your cvv",
            "your card number",
            "card details",
            "login details",
            "ibigay ang mpin",
            "ibigay ang pin",
            "ilagay ang mpin",
        )

    private val CREDENTIAL_ASK_VERBS =
        listOf("send", "reply", "provide", "enter", "confirm", "update", "verify", "ibigay", "ilagay", "i-reply")

    // "We will never ask for your PIN" is the genuine warning, not a request.
    private val DISCLAIMER_WORDS = listOf("never", "huwag", "hindi kailanman")

    private fun asksForCredentials(text: String): Boolean =
        CREDENTIAL_REQUEST_PHRASES.any { text.contains(it) } &&
            CREDENTIAL_ASK_VERBS.any { text.contains(it) } &&
            DISCLAIMER_WORDS.none { text.contains(it) }

    /**
     * A reason a message under a trusted sender name (BDO, GCash, Globe...)
     * may not really be from them, or null. Sender names are trivially faked
     * -- e.g. by SMS blasters (fake cell towers) that never pass through the
     * telco -- so the content is what gives a spoof away:
     * - banks, e-wallets and agencies were told by the BSP to stop sending
     *   clickable links by text, so any link off their official domains is
     *   a red flag (telcos and apps do send their own short links, so this
     *   check is only for [TrustedSenders.isFinancial] names);
     * - no legitimate sender asks you to send them an OTP, or for a PIN,
     *   password or card details;
     * - the same link signals as [looksSuspicious] (a lookalike domain, an
     *   account threat with an unofficial link, a prize with a risky link).
     *   These also catch the other way a "real" sender goes wrong: the
     *   company's own account or SMS gateway being hacked and used to send
     *   scams, where the sender name is genuine but the content isn't.
     */
    fun spoofWarning(
        sender: String,
        body: String,
    ): String? {
        val text = body.lowercase()
        val name = sender.trim()
        return when {
            !TrustedSenders.isBuiltIn(sender) -> null
            OTP_REQUEST_PHRASES.any { text.contains(it) } ->
                "Real companies never ask you to send them an OTP. This may not be from $name."
            asksForCredentials(text) ->
                "Real companies never ask for your PIN, password or card details by text. This may not be from $name."
            TrustedSenders.isFinancial(sender) && linkHosts(text).any { !isOfficial(it) } ->
                "Banks and e-wallets don't send links by text. This may not be from $name."
            looksSuspicious(body) ->
                "This link doesn't go to $name's official website. The name may be faked, or their account hacked."
            else -> null
        }
    }

    private fun linkHosts(text: String): List<String> =
        HOST_REGEX
            .findAll(text)
            .map { it.groupValues[1].trimEnd('.') }
            .filter { it.substringAfterLast('.') in KNOWN_TLDS }
            .toList()

    private fun registeredDomain(host: String): String {
        val labels = host.split('.')
        // bdo.com.ph keeps three labels; gcash-verify.com keeps two.
        val isPhSecondLevel =
            labels.size >= PH_SECOND_LEVEL_LABELS &&
                labels.last() == "ph" &&
                labels[labels.size - 2] in PH_SECOND_LEVEL_DOMAINS
        val keep = if (isPhSecondLevel) PH_SECOND_LEVEL_LABELS else REGISTERED_DOMAIN_LABELS
        return labels.takeLast(keep).joinToString(".")
    }

    private fun isOfficial(host: String): Boolean = OFFICIAL_DOMAINS.any { host == it || host.endsWith(".$it") }

    private fun isLookalike(host: String): Boolean {
        if (isOfficial(host)) return false
        val domain = registeredDomain(host)
        return BRAND_TOKENS.any { domain.contains(it) }
    }

    private fun isRisky(host: String): Boolean =
        !isOfficial(host) &&
            (registeredDomain(host) in SHORTENERS || host.substringAfterLast('.') in RISKY_TLDS || isLookalike(host))
}
