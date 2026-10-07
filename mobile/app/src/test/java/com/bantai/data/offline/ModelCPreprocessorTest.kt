package com.bantai.data.offline

import org.junit.Assert.assertEquals
import org.junit.Test

class ModelCPreprocessorTest {
    @Test
    fun `matches training preprocessing order and placeholders`() {
        assertEquals(
            "Email <EMAIL> visit <URL> call <PHONE> claim <AMOUNT> code <OTP>",
            ModelCPreprocessor.preprocess(
                "Email test@example.com visit hxxps://bad.ph/x call 0917-123-4567 claim ₱5,000 code 123456",
            ),
        )
    }

    @Test
    fun `normalizes full width text and Unicode whitespace like Python`() {
        assertEquals(
            "GCash account locked",
            ModelCPreprocessor.preprocess(" ＧＣａｓｈ\u0085account\u2003locked "),
        )
    }

    @Test
    fun `Unicode word character prevents phone match like Python lookbehind`() {
        assertEquals("é09171234567", ModelCPreprocessor.preprocess("é09171234567"))
    }

    @Test
    fun `matches Python control whitespace and Unicode digits`() {
        assertEquals("x y", ModelCPreprocessor.preprocess("x\u001Cy"))
        assertEquals("code<OTP>", ModelCPreprocessor.preprocess("code١٢٣٤٥٦"))
        assertEquals("+<EMAIL>", ModelCPreprocessor.preprocess("+test@example.com"))
        assertEquals("e\u0332<PHONE>", ModelCPreprocessor.preprocess("e\u033209171234567"))
        assertEquals("a\u203f<PHONE>", ModelCPreprocessor.preprocess("a\u203f09171234567"))
    }
}
