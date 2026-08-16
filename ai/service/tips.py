"""Scam awareness tip lookup (Sprint 3, WBS 3.3.7).

Manuscript Stage 6: "The cluster ID from Stage 5b is used to look up a
matching scam awareness card", rendered as a "plain-language education card
with scam type description and recommended user actions" (Table 3).

**Keying, and why it isn't purely by cluster ID.** Taking the manuscript
literally -- a hand-written card per cluster ID -- breaks the moment HDBSCAN
discovers a new campaign, because a brand-new cluster has no card yet and the
user would get nothing. So lookup resolves in two steps:

    1. an explicit ``CLUSTER_TIP_OVERRIDES`` entry for that cluster ID, if an
       admin has written one; otherwise
    2. the cluster's dominant SHAP indicator tag -> that tag's card.

Every cluster therefore always resolves to *something* sensible, and specific
campaigns can still be given bespoke copy. The tag vocabulary is exactly the
one in ``service/indicator_tags.py`` (WBS 3.1.2), so the explanation the user
sees ("Prize Lure") and the education card they get are guaranteed to agree.

Copy is written for non-technical Filipino readers, English with the Taglish
phrasing people actually use ("wag i-click"), following the register of real
telco/bank advisories already in the dataset. Text is deliberately data, not
code -- it is expected to be revised by the team without touching logic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence


@dataclass(frozen=True)
class ScamTip:
    """One scam awareness card."""

    tag: str
    title: str
    description: str  # what this kind of scam is
    actions: List[str]  # what the user should do

    def to_dict(self) -> dict:
        return {
            "tag": self.tag,
            "title": self.title,
            "description": self.description,
            "actions": list(self.actions),
        }


_TIPS: Dict[str, ScamTip] = {
    "Prize Lure": ScamTip(
        tag="Prize Lure",
        title="You 'won' something you never joined",
        description=(
            "Scammers open with congratulations and a prize to get you excited "
            "enough to click before you think. If you never entered a raffle or "
            "promo, there is no prize -- the goal is to get you onto a fake page "
            "that asks for your OTP, card details, or a 'processing fee'."
        ),
        actions=[
            "Wag i-click ang link, kahit mukhang legit ang brand.",
            "Real promos never ask you to pay a fee to claim a prize.",
            "Verify in the official app instead -- open GCash or GlobeOne yourself.",
            "Block and report the sender, then delete the message.",
        ],
    ),
    "Suspicious URL": ScamTip(
        tag="Suspicious URL",
        title="That link does not go where it says",
        description=(
            "The message carries a shortened or unfamiliar link (bit.ly, cutt.ly, "
            "or a lookalike domain). Shorteners hide the real destination until "
            "you have already tapped it. Legitimate Philippine banks and telcos "
            "send links only on their own domains -- and most now say outright "
            "that they never send links at all."
        ),
        actions=[
            "Never tap a shortened link from an unknown sender.",
            "Type the official website yourself instead of following a link.",
            "Check for lookalike spellings -- 'gcash-verify.xyz' is not GCash.",
            "If unsure, contact the company through their official hotline.",
        ],
    ),
    "Brand Impersonation": ScamTip(
        tag="Brand Impersonation",
        title="Someone is pretending to be a brand you trust",
        description=(
            "This message uses a real company's name -- a bank, telco, or "
            "e-wallet -- but the link does not belong to that company. Copying a "
            "trusted name costs the scammer nothing, and it is the fastest way to "
            "make you lower your guard."
        ),
        actions=[
            "Ang totoong bangko ay hindi hihingi ng OTP o password sa text.",
            "Open the company's official app directly to check your account.",
            "Compare the sender to previous legitimate messages from that brand.",
            "Report the message to the company and to the NTC.",
        ],
    ),
    "Urgency Cue": ScamTip(
        tag="Urgency Cue",
        title="They want you to panic, not to think",
        description=(
            "'Expires today', 'act now', 'within 24 hours' -- artificial time "
            "pressure is a core social-engineering tactic. Rushing you is the "
            "point: a person in a hurry does not stop to verify."
        ),
        actions=[
            "Huminga muna. Real deadlines still exist tomorrow.",
            "Any message pressuring you to act immediately deserves more scrutiny.",
            "Verify through official channels before doing anything.",
            "Ask someone you trust for a second opinion.",
        ],
    ),
    "Gambling Bait": ScamTip(
        tag="Gambling Bait",
        title="Fake betting credit that is not really yours",
        description=(
            "These claim you already have a balance, bonus, or free credits "
            "waiting -- 'play or cash out now'. The 'balance' does not exist. "
            "Trying to withdraw it leads to a deposit request, ID upload, or a "
            "fake app install. Many of these blasts falsely claim PAGCOR approval."
        ),
        actions=[
            "Hindi ka makakatanggap ng pera mula sa app na hindi mo ginamit.",
            "Never deposit money to 'unlock' a withdrawal -- that is the scam.",
            "Do not install apps from SMS links.",
            "Block the sender; these campaigns blast repeatedly.",
        ],
    ),
    "Fake Job Offer": ScamTip(
        tag="Fake Job Offer",
        title="Work-from-home offer that costs you money",
        description=(
            "Unsolicited offers of easy home-based income -- 'earn while at "
            "home', 'copy-paste system', appointment setter roles -- usually via "
            "a Messenger or chat link. Real employers do not recruit strangers by "
            "SMS. These end in a 'training fee', a package scam, or your details "
            "being resold."
        ),
        actions=[
            "Walang lehitimong trabaho na nanghihingi ng bayad bago ka magsimula.",
            "Research the company independently before replying.",
            "Never send IDs or personal documents to a chat contact.",
            "Be wary of income promises that sound too good for the effort.",
        ],
    ),
    "Unsolicited Credit Offer": ScamTip(
        tag="Unsolicited Credit Offer",
        title="A loan you never applied for",
        description=(
            "'Pre-approved', 'you are qualified', 'no collateral' -- lenders do "
            "not pre-grant money to strangers over SMS. These harvest your ID "
            "documents, or collect an 'advance/processing fee' for a loan that "
            "never arrives. The SEC has repeatedly warned about advance-fee loans."
        ),
        actions=[
            "Kung may bayad bago mo makuha ang loan, scam 'yan.",
            "Deal only with SEC-registered lending companies.",
            "Never send photos of your IDs or cards to an unverified contact.",
            "Check the lender on the SEC website before engaging.",
        ],
    ),
    "Personal Info Request": ScamTip(
        tag="Personal Info Request",
        title="They are collecting your identity",
        description=(
            "The message asks you to send government IDs, a photo of your card, "
            "or personal details -- often by email, to look official. This is "
            "identity harvesting. With an ID and a card photo, someone can open "
            "accounts or take loans in your name."
        ),
        actions=[
            "Wag magpadala ng ID o litrato ng card sa text o email request.",
            "Legitimate institutions verify inside their own app or branch.",
            "A Gmail address is never an official corporate channel.",
            "If you already sent something, contact your bank immediately.",
        ],
    ),
    "OTP / Account Phishing": ScamTip(
        tag="OTP / Account Phishing",
        title="They are after your OTP or account access",
        description=(
            "Warnings that your account will be blocked, suspended, or "
            "deactivated unless you verify right away. The link leads to a fake "
            "login page. Your OTP is the last thing standing between a scammer "
            "and your money -- which is exactly why they ask for it."
        ),
        actions=[
            "WAG i-share ang OTP mo kahit kanino -- walang lehitimong staff ang hihingi nito.",
            "Never log in through a link sent by SMS.",
            "Open the official app yourself and check for real notices.",
            "If you shared an OTP, change your password and call the bank now.",
        ],
    ),
}

#: Bespoke copy for specific campaign clusters, when the generic tag-based card
#: is not specific enough. Empty by design -- populated by admins from the
#: dashboard as notable campaigns are identified, not hard-coded here.
CLUSTER_TIP_OVERRIDES: Dict[str, str] = {}

#: Shown when nothing else resolves (e.g. a cluster whose messages produced no
#: indicator tags at all). Never leaves the user with a blank card.
FALLBACK_TIP = ScamTip(
    tag="General",
    title="Treat unexpected messages with caution",
    description=(
        "This message was flagged as suspicious, but it does not match a "
        "specific scam pattern we recognize. Unexpected messages asking you to "
        "click, pay, or share information deserve a second look regardless."
    ),
    actions=[
        "Wag i-click ang link mula sa hindi kilalang sender.",
        "Never share OTPs, passwords, or card details.",
        "Verify through the company's official app or hotline.",
        "Report the message so others can be protected too.",
    ],
)


def tip_for_tag(tag: str) -> ScamTip:
    """Card for one indicator tag, falling back to the generic card."""
    return _TIPS.get(tag, FALLBACK_TIP)


def tip_for_cluster(
    cluster_id: Optional[str],
    indicator_tags: Optional[Sequence[str]] = None,
) -> ScamTip:
    """Card for a campaign cluster (manuscript Stage 6 lookup).

    Resolution order: admin override for this cluster -> the cluster's
    dominant (highest-weighted, i.e. first) indicator tag -> generic card.
    ``indicator_tags`` is expected already sorted most-influential-first, which
    is what ``indicator_tags.tags_for_message`` returns.
    """
    if cluster_id is not None and cluster_id in CLUSTER_TIP_OVERRIDES:
        return tip_for_tag(CLUSTER_TIP_OVERRIDES[cluster_id])
    if indicator_tags:
        return tip_for_tag(indicator_tags[0])
    return FALLBACK_TIP


def all_tips() -> List[ScamTip]:
    """Every card -- backs the Settings > Scam Awareness Tips screen."""
    return list(_TIPS.values())
