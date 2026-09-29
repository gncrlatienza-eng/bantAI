package com.bantai.ui.theme

import androidx.compose.ui.unit.sp

/**
 * The app's one type scale, after iOS's text styles (Large Title, Title,
 * Headline, Body, Subheadline, Footnote, Caption), sized for Android.
 * Every screen picks from these instead of ad-hoc sizes, so the same kind
 * of text is the same size everywhere:
 *
 * - [LargeTitle] -- tab titles (Messages, Alerts, Campaigns, Settings)
 * - [Title] -- hero headings on a page (a sender's name, a result screen)
 * - [Headline] -- top-bar titles, dialog titles, sheet titles
 * - [Body] -- list-row titles, message text, buttons, section headers
 * - [Subhead] -- secondary lines: previews, descriptions
 * - [Footnote] -- timestamps, counts, helper text
 * - [Caption] -- small labels and badges
 * - [Caption2] -- the smallest text: tiny tags, bubble times
 */
object TextSize {
    val LargeTitle = 32.sp
    val Title = 22.sp
    val Headline = 17.sp
    val Body = 15.sp
    val Subhead = 14.sp
    val Footnote = 13.sp
    val Caption = 12.sp
    val Caption2 = 11.sp
}
