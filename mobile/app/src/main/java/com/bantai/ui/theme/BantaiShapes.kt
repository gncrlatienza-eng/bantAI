package com.bantai.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

/**
 * The few corner radii the app uses, so cards, chips and banners agree with
 * each other instead of each picking its own number.
 */
object BantaiShapes {
    val Small = RoundedCornerShape(10.dp)
    val Medium = RoundedCornerShape(14.dp)
    val Large = RoundedCornerShape(18.dp)
    val Pill = RoundedCornerShape(100.dp)
}

/**
 * The tab bar's frosted look (translucent fill, hairline edge, soft shadow) for
 * banners and cards that float over content, so they match the bar.
 */
@Composable
fun Modifier.glassSurface(shape: Shape = BantaiShapes.Medium): Modifier =
    this
        .shadow(12.dp, shape, ambientColor = Color.Black.copy(alpha = 0.4f), spotColor = Color.Black.copy(alpha = 0.4f))
        .clip(shape)
        .background(GlassFill)
        .border(1.dp, GlassStroke, shape)
