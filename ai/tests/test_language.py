"""Language guard: only clearly foreign-language texts are flagged."""

from __future__ import annotations

import pytest

from service.language import is_supported_language


@pytest.mark.parametrize(
    "text",
    [
        "Your GCash account will be suspended. Verify your account now at gcash-verify.com/login",
        "Congratulations! Nanalo ka ng P10,000 sa Shopee raffle. I-claim na: bit.ly/shp-prize",
        "Hi anak, pauwi na ako, bili ka ng tinapay",
        "Your OTP is 482913. Do not share this code with anyone.",
        "LBC: parcel on hold",  # too short to judge -> trust the model
    ],
)
def test_english_filipino_and_short_texts_are_supported(text):
    assert is_supported_language(text)


@pytest.mark.parametrize(
    "text",
    [
        "Ciao! Il tuo pacco è in consegna oggi, grazie per la pazienza.",
        "Hola, su pedido está en camino. Gracias por su compra, que tenga un buen día.",
        "Bonjour, votre colis est en cours de livraison. Merci pour votre commande.",
        "您的包裹已到达，请点击链接确认收货地址",
    ],
)
def test_clearly_foreign_texts_are_not_supported(text):
    assert not is_supported_language(text)
