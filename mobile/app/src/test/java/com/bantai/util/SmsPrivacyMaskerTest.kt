package com.bantai.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class SmsPrivacyMaskerTest {
    @Test
    fun `masks an unbroken PH mobile number`() {
        val result = SmsPrivacyMasker.maskForRemoteClassification("Call 09171234567 now")
        assertEquals("Call [PHONE] now", result)
    }

    @Test
    fun `masks a spaced PH mobile number`() {
        // H7: previously only the unbroken digit form matched at all.
        val result = SmsPrivacyMasker.maskForRemoteClassification("Contact 0917 123 4567 today")
        assertEquals("Contact [PHONE] today", result)
    }

    @Test
    fun `masks a dashed plus-63 PH mobile number`() {
        val result = SmsPrivacyMasker.maskForRemoteClassification("+63-917-123-4567 is the number")
        assertEquals("[PHONE] is the number", result)
    }

    @Test
    fun `masks a url`() {
        val result = SmsPrivacyMasker.maskForRemoteClassification("Click http://bit.ly/abc123 now")
        assertEquals("Click [URL] now", result)
    }

    @Test
    fun `masks an email`() {
        // H7: previously not masked at all.
        val result = SmsPrivacyMasker.maskForRemoteClassification("Reply to scammer@example.com")
        assertEquals("Reply to [EMAIL]", result)
    }

    @Test
    fun `email masking does not leak the local part via bareDomain`() {
        val result = SmsPrivacyMasker.maskForRemoteClassification("user.name+tag@sub.example.com")
        assertEquals("[EMAIL]", result)
        assertFalse(result.contains("user"))
    }

    @Test
    fun `masks a keyword-prefixed otp with a wide gap`() {
        val result = SmsPrivacyMasker.maskForRemoteClassification("Your one-time verification code is: 123456")
        assertEquals("Your one-time verification code is: [OTP]", result)
    }

    @Test
    fun `masks a bare long digit run with no keyword as a generic number`() {
        // H7: an OTP/account/landline number with no recognizable keyword nearby
        // used to pass through completely unmasked.
        val result = SmsPrivacyMasker.maskForRemoteClassification("Ref no. 8823456712, thanks")
        assertEquals("Ref no. [NUMBER], thanks", result)
    }

    @Test
    fun `masks a formatted landline number`() {
        // The area code alone ("02") is only 2 digits -- too short to be worth
        // masking on its own (see MIN_GENERIC_DIGIT_RUN) -- but the 8-digit
        // subscriber number is masked.
        val result = SmsPrivacyMasker.maskForRemoteClassification("Call (02) 8631-8000 for help")
        assertEquals("Call (02) [NUMBER] for help", result)
    }

    @Test
    fun `does not mask short digit runs`() {
        val result = SmsPrivacyMasker.maskForRemoteClassification("You have 3 new messages, 50% off")
        assertEquals("You have 3 new messages, 50% off", result)
    }

    @Test
    fun `masks a peso amount`() {
        val result = SmsPrivacyMasker.maskForRemoteClassification("You sent ₱1,500.00 to Juan")
        assertEquals("You sent [AMOUNT] to Juan", result)
    }
}
