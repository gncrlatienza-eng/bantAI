package com.bantai.data.remote

import org.json.JSONObject

// org.json's optString(name) turns a JSON `null` value into the literal 4-char
// string "null" (JSONObject.NULL.toString()), not a real null — so a plain
// isNotEmpty() check doesn't catch it. That literal string previously slipped
// through as a real clusterId and crashed campaign navigation (see SmsApi),
// and separately showed campaigns with no label as literally titled "null"
// (see CampaignsApi) -- both call sites share this one fix rather than
// re-deriving it.
internal fun JSONObject.optNullableString(name: String): String? {
    val value = optString(name)
    return value.takeIf { it.isNotEmpty() && it != "null" }
}
