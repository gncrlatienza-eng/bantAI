"""Is a message in a language the model was trained on?

The classifier was fine-tuned on English, Filipino and Taglish SMS. XLM-RoBERTa
is multilingual, so it still produces confident-looking scores for other
languages -- but those scores are out of distribution. Seen live 2026-09-30:
ordinary Italian texts on a tester's phone came back as confident Scam and
their senders were auto-blocked.

This is a deliberately small, dependency-free check (no language-detection
package): count common function words for the supported languages against a
handful of other languages BantAI users are likely to receive texts in, and
flag the message only when it clearly reads as one of those. Anything short or
ambiguous counts as supported, so the model keeps deciding the normal cases.
"""

from __future__ import annotations

import re

_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)

# Function words and very common SMS words. Kept to words that are not also
# common in the "other" lists below.
_SUPPORTED = frozenset(
    """
    the a an and or to of in on for is are was were be been you your yours we our
    us it its this that these those with at by from have has had will would can
    could not no yes now please pls here there get got just i my me do does did
    if as all up out more only so but what when where who how why then than
    ng sa ang mga na ka ko mo po ito iyan yan yung lang din rin pa naman kung
    may wala hindi di akin natin namin kayo sila siya ako ikaw ba nga daw raw
    pag kapag dahil kasi nang nyo niyo opo salamat tayo kami ninyo niya nila
    ano sino saan kailan bakit paano ngayon bukas mamaya
    """.split()
)

_OTHER = frozenset(
    """
    il lo gli della delle degli nel nella sono tuo tua suo sua questo questa
    qui ciao grazie perché anche più è
    el los las del que es por con su tu una uno al se muy gracias hola usted
    le les des du est vous nous votre avec pour sur une dans pas merci bonjour
    os das dos não você seu sua obrigado olá
    der die das und ist nicht mit sie ich ein eine den dem für auf danke hallo
    yang dan untuk dengan anda ini itu dari tidak akan terima kasih
    """.split()
)

#: Below this many words there's too little to tell; trust the model.
MIN_WORDS = 4

#: Needs at least this many other-language hits before overriding anything.
MIN_OTHER_HITS = 2

#: Share of letters that must be Latin script for the message to count as
#: possibly English/Filipino at all (Chinese, Arabic, Cyrillic... are not).
MIN_LATIN_SHARE = 0.5


def _latin_share(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 1.0
    latin = sum(1 for c in letters if c.isascii() or "À" <= c <= "ɏ")
    return latin / len(letters)


def is_supported_language(text: str) -> bool:
    """True unless the message clearly reads as a language the model wasn't trained on."""
    if _latin_share(text or "") < MIN_LATIN_SHARE:
        return False
    words = [w.lower() for w in _WORD_RE.findall(text or "")]
    if len(words) < MIN_WORDS:
        return True
    supported = sum(1 for w in words if w in _SUPPORTED)
    other = sum(1 for w in words if w in _OTHER)
    return not (other >= MIN_OTHER_HITS and other > supported)
