package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bantai.ui.theme.Hairline
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSecondary
import com.bantai.ui.theme.TextTertiary
import com.bantai.ui.theme.White

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isLoading: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Indigo,
            disabledContainerColor = Indigo.copy(alpha = 0.4f),
        ),
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = White,
                strokeWidth = 2.dp,
            )
        } else {
            Text(text, color = White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        }
    }
}

@Composable
fun PillTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp)
            .background(SurfaceElevated, RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.weight(1f)) {
            if (value.isEmpty() && placeholder.isNotEmpty()) {
                Text(placeholder, color = TextSecondary, fontSize = 16.sp)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(color = White, fontSize = 16.sp),
                cursorBrush = SolidColor(Indigo),
                keyboardOptions = keyboardOptions,
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        color = TextTertiary,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 1.sp,
    )
}

@Composable
fun OnboardingHeader(
    title: String,
    modifier: Modifier = Modifier,
    eyebrow: String? = null,
    subtitle: String? = null,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (eyebrow != null) {
            SectionLabel(eyebrow)
            Spacer(Modifier.height(10.dp))
        }
        Text(title, color = White, fontWeight = FontWeight.Bold, fontSize = 32.sp)
        if (subtitle != null) {
            Spacer(Modifier.height(8.dp))
            Text(subtitle, color = TextSecondary, fontSize = 14.sp, lineHeight = 19.sp)
        }
    }
}

@Composable
fun GroupedCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(SurfaceElevated, RoundedCornerShape(16.dp)),
        content = content,
    )
}

@Composable
fun GroupedDivider(startInset: Dp = 64.dp) {
    HorizontalDivider(
        color = Hairline,
        thickness = 0.5.dp,
        modifier = Modifier.padding(start = startInset),
    )
}

@Composable
fun AccentIconTile(
    icon: ImageVector,
    accent: Color = Indigo,
    size: Dp = 36.dp,
) {
    Box(
        modifier = Modifier
            .size(size)
            .background(accent.copy(alpha = 0.15f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(size / 2))
    }
}

@Composable
fun FeatureListRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    accent: Color = Indigo,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AccentIconTile(icon = icon, accent = accent)
        Spacer(Modifier.width(12.dp))
        Column {
            Text(title, color = White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(subtitle, color = TextSecondary, fontSize = 13.sp, lineHeight = 18.sp)
        }
    }
}
