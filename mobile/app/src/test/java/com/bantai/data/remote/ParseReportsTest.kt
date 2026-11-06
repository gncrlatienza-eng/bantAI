package com.bantai.data.remote

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ParseReportsTest {
    private fun entry(
        id: String,
        report: String,
    ) = """{"id":"$id","status":"Reported","message":{"id":"m-$id","sourceId":"k:7","reports":[$report]}}"""

    @Test
    fun `reads the reviewer's label on a rejected report`() {
        val report = """{"reportedLabel":"Scam","status":"Rejected","reviewedLabel":"Ham"}"""
        val json = JSONArray("[${entry("1", report)}]")
        assertEquals(
            "Ham",
            SmsApi
                .parseAlerts(json)
                .single()
                .report
                ?.reviewedLabel,
        )
    }

    @Test
    fun `a backend without the field reads as no label`() {
        val json = JSONArray("[${entry("1", """{"reportedLabel":"Scam","status":"Rejected"}""")}]")
        assertNull(
            SmsApi
                .parseAlerts(json)
                .single()
                .report
                ?.reviewedLabel,
        )
        val nullReport = """{"reportedLabel":"Scam","status":"Rejected","reviewedLabel":null}"""
        val explicitNull = JSONArray("[${entry("2", nullReport)}]")
        assertNull(
            SmsApi
                .parseAlerts(explicitNull)
                .single()
                .report
                ?.reviewedLabel,
        )
    }

    @Test
    fun `one malformed entry doesn't sink the rest`() {
        val good = entry("1", """{"reportedLabel":"Spam","status":"Pending"}""")
        val json = JSONArray("""[{"id":"bad","message":null}, 42, $good]""")
        assertEquals(listOf("m-1"), SmsApi.parseAlerts(json).map { it.messageId })
    }
}
