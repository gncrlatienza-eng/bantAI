package com.bantai.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.White

private data class TipContent(
    val quote: String,
    val whatIsIt: String,
    val redFlagTitle: String,
    val redFlags: List<String>,
    val whatToDo: String,
)

private fun tipContent(tip: String): TipContent = when (tip) {
    "gcash" -> TipContent(
        quote = "GCash will never ask for your MPIN, OTP, or password via SMS.",
        whatIsIt = "GCash impersonation is the most common smishing attack in the Philippines. Scammers send texts that look like official GCash messages — using the brand name, urgency language, and fake account warnings — to trick you into tapping a link or revealing your OTP.",
        redFlagTitle = "Red flags to watch for",
        redFlags = listOf(
            "Links to domains other than gcash.com (e.g., gcash-ph-support.net, gcash-verify.ph)",
            "\"Your account will be suspended in 24 hours\" or similar threats",
            "Any message asking for your MPIN, OTP, or 4-digit PIN",
            "Sender is a random number, not the official GCASH shortcode",
        ),
        whatToDo = "Do not tap the link. Open the official GCash app directly to check your account status. If you receive an OTP you did not request, someone may be attempting to log in — change your MPIN immediately and report it through the in-app Help Center.",
    )

    "urgency" -> TipContent(
        quote = "Urgency is a weapon. Scammers use it to stop you from thinking clearly.",
        whatIsIt = "Urgency language is a psychological manipulation tactic used in nearly every smishing attempt. By creating artificial deadlines (\"Act now or your account is deleted\"), scammers try to bypass your judgment and get you to act before you reflect on whether the message is real.",
        redFlagTitle = "Urgency phrases to recognize",
        redFlags = listOf(
            "\"24 hours\", \"immediately\", \"urgent action required\", \"act now\"",
            "\"Your account will be suspended / deleted / locked\"",
            "Countdown pressure with no clear legitimate reason",
            "Threats of fines, legal action, or account closure from unknown senders",
        ),
        whatToDo = "Pause before acting. Any message that pressures you to respond immediately is a red flag. Legitimate companies do not suspend accounts via SMS without prior notice sent through official channels. Verify directly by opening the official app yourself — never through the link in the message.",
    )

    "links" -> TipContent(
        quote = "A link that hides where it goes is a link hiding what it does.",
        whatIsIt = "Phishing links disguise malicious websites as legitimate ones. Scammers use URL shorteners (bit.ly, tinyurl), typosquatted domains (gcash-ph.net instead of gcash.com), or long confusing URLs so you cannot tell where you are going. The fake site may even copy the official brand's colors and logos.",
        redFlagTitle = "Suspicious link patterns",
        redFlags = listOf(
            "Shortened links (bit.ly, tinyurl, t.co) in unsolicited messages",
            "Domain names that almost-match real brands (bdo-secure.net, gcash-support.ph)",
            "HTTP instead of HTTPS — no padlock means no encryption",
            "Long URLs with random strings or dashes after an unfamiliar domain",
        ),
        whatToDo = "Do not tap links in SMS from unknown senders. For any account action, open the official app or type the official website address directly into your browser. If you already tapped: close the page immediately, clear your browser history, and change the account password as a precaution.",
    )

    "otp" -> TipContent(
        quote = "Your OTP is the last door between a scammer and your account. Never hand them the key.",
        whatIsIt = "OTP (One-Time Password) scams trick you into sharing your verification code, giving the attacker complete access to your account. By the time they message you asking for the code, they have already obtained your credentials and are in the middle of logging in.",
        redFlagTitle = "How OTP scams work",
        redFlags = listOf(
            "Anyone asking for your OTP via call, text, or chat — even people claiming to be bank staff",
            "Receiving an OTP you did not request yourself",
            "\"Please share the code we just sent you to verify your identity\"",
            "Urgency about confirming an account action you did not initiate",
        ),
        whatToDo = "Never share your OTP with anyone. No legitimate bank, e-wallet, or company will ever ask you for it. If you receive an unsolicited OTP, your account is likely under attack — change your password or MPIN immediately, then contact the service provider's official support to lock the account.",
    )

    "action" -> TipContent(
        quote = "Being scammed is not your fault. What you do next is what matters.",
        whatIsIt = "If you have already tapped a link, shared personal information, or sent money, there are concrete steps you can take to limit the damage. Acting within the first hour gives you the best chance of preventing further loss.",
        redFlagTitle = "Signs you may have been scammed",
        redFlags = listOf(
            "You shared your OTP, MPIN, card number, or ID photos with someone",
            "Money was transferred from your account without your intent",
            "You entered credentials on a website you reached through an SMS link",
            "A \"job offer\" or \"prize\" required an upfront payment before paying out",
        ),
        whatToDo = "1. Change all passwords and MPIN immediately. 2. Call your bank or e-wallet to freeze your account (GCash: 1-800-8-GCASH, BDO: (02) 8631-8000). 3. File a report with BSP Consumer Protection (consumeraffairs@bsp.gov.ph) for bank fraud. 4. Report the sender to NTC at txt.ntc.gov.ph. 5. Block the sender in BantAI and delete the message thread.",
    )

    "shap" -> TipContent(
        quote = "BantAI shows its reasoning — not just its answer.",
        whatIsIt = "SHAP (SHapley Additive exPlanations) is a machine learning technique that explains model decisions. When BantAI flags a message, it uses SHAP to identify which words or patterns drove that classification — producing the Threat Indicators you see on the alert screen.",
        redFlagTitle = "How to read the indicators",
        redFlags = listOf(
            "Longer bars = stronger signal — that feature had more influence on the classification",
            "Multiple indicators together (e.g., Urgency Cue + Suspicious URL) build a stronger combined case",
            "An empty indicators section means SHAP is still computing — it arrives a few seconds after the alert",
            "Tag names are plain language: \"Prize Lure\", \"Brand Impersonation\", \"OTP / Account Phishing\"",
        ),
        whatToDo = "Use the indicators as context, not as final proof. If BantAI flagged a message but none of the indicators match what you are reading, tap Report to help improve the model. Your judgment plus BantAI's analysis is always stronger than either alone.",
    )

    else -> TipContent(
        quote = "Learning how scams work is your first line of defense.",
        whatIsIt = "Smishing (SMS phishing) is a type of fraud where attackers send text messages pretending to be trusted brands to steal your credentials or money.",
        redFlagTitle = "Red flags to watch for",
        redFlags = listOf(
            "Unexpected urgency or threats about your account",
            "Links to unfamiliar or misspelled domains",
            "Requests for OTP or personal information",
            "Sender is an unknown number impersonating a brand",
        ),
        whatToDo = "Do not click the link. Do not reply. Block the sender and report it through BantAI. If you already clicked, change your password immediately and contact your bank.",
    )
}

private fun tipTitle(tip: String) = when (tip) {
    "gcash"   -> "How to spot a GCash scam"
    "urgency" -> "Why scammers use urgency"
    "links"   -> "Safe links vs phishing links"
    "otp"     -> "OTP scams explained"
    "action"  -> "What to do when scammed"
    "shap"    -> "Understanding SHAP scores"
    else      -> "Scam Awareness Tip"
}

@Composable
fun TipDetailScreen(tip: String, navController: NavController) {
    val title = tipTitle(tip)
    val content = tipContent(tip)

    Column(modifier = Modifier.fillMaxSize().background(Black)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 4.dp, vertical = 4.dp),
        ) {
            IconButton(
                onClick = { navController.popBackStack() },
                modifier = Modifier.align(Alignment.CenterStart),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = White)
            }
            Text(
                "Tip",
                color = White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        HorizontalDivider(color = Surface)

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Spacer(Modifier.height(4.dp))
                Text("BantAI Education · 3 min read", color = TextSecondary, fontSize = 12.sp)
            }

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF16163A), RoundedCornerShape(12.dp))
                        .padding(16.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        Icons.Filled.Shield,
                        contentDescription = null,
                        tint = Indigo,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        content.quote,
                        color = Indigo,
                        fontSize = 13.sp,
                        fontStyle = FontStyle.Italic,
                    )
                }
            }

            item {
                SectionHeading("What is it?")
                Spacer(Modifier.height(8.dp))
                Text(
                    content.whatIsIt,
                    color = TextSecondary,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                )
            }

            item {
                SectionHeading(content.redFlagTitle)
                Spacer(Modifier.height(8.dp))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    content.redFlags.forEach { flag ->
                        BulletPoint(flag)
                    }
                }
            }

            item {
                SectionHeading("What to do")
                Spacer(Modifier.height(8.dp))
                Text(
                    content.whatToDo,
                    color = TextSecondary,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                )
            }
        }
    }
}

@Composable
private fun SectionHeading(text: String) {
    Text(text, color = White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
}

@Composable
private fun BulletPoint(text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Text("·  ", color = TextSecondary, fontSize = 14.sp)
        Text(text, color = TextSecondary, fontSize = 14.sp, lineHeight = 22.sp)
    }
}
