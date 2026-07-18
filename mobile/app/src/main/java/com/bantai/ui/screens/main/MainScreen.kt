package com.bantai.ui.screens.main

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.navigation.Screen
import com.bantai.ui.screens.settings.SettingsScreen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.White
import com.bantai.viewmodel.SettingsViewModel

private data class NavTab(
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
)

private val navTabs = listOf(
    NavTab("Messages",  Icons.Outlined.ChatBubbleOutline, Icons.Filled.ChatBubble),
    NavTab("Alerts",    Icons.Outlined.Notifications,     Icons.Filled.Notifications),
    NavTab("Campaigns", Icons.Outlined.Campaign,          Icons.Filled.Campaign),
    NavTab("Settings",  Icons.Outlined.Settings,          Icons.Filled.Settings),
)

// Translucent dark "glass" — approximates the iOS 26 Liquid Glass material
// without a backdrop-blur dependency.
private val GlassFill = Color(0xE61A1A1F)
// Extra-translucent fill for the collapsed pill so content reads through it.
private val GlassFillCollapsed = Color(0x8C1A1A1F)
private val GlassStroke = Color(0x21FFFFFF)
private val Unselected = Color(0xFF8E8E93)

@Composable
fun MainScreen(navController: NavController, settingsViewModel: SettingsViewModel) {
    var selectedTab by rememberSaveable { mutableStateOf(0) }
    var barExpanded by rememberSaveable { mutableStateOf(false) }

    // Content draws edge to edge behind the floating bar.
    val contentPadding = PaddingValues(bottom = 116.dp)

    Box(modifier = Modifier.fillMaxSize().background(Black)) {
        when (selectedTab) {
            0 -> MessagesScreen(navController, contentPadding)
            1 -> AlertsScreen(navController, contentPadding)
            2 -> CampaignsScreen(navController, contentPadding)
            3 -> SettingsScreen(contentPadding, navController, settingsViewModel)
        }

        // Tapping anywhere outside the expanded bar collapses it back to the pill.
        if (barExpanded) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = { barExpanded = false },
                    ),
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(horizontal = 24.dp)
                .padding(bottom = 12.dp)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center,
        ) {
            FloatingTabBar(
                selected = selectedTab,
                expanded = barExpanded,
                onSelect = { index ->
                    selectedTab = index
                    barExpanded = false
                },
                onExpand = { barExpanded = true },
            )
        }
    }
}

@Composable
private fun FloatingTabBar(
    selected: Int,
    expanded: Boolean,
    onSelect: (Int) -> Unit,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .shadow(24.dp, RoundedCornerShape(32.dp), ambientColor = Black, spotColor = Black)
            .clip(RoundedCornerShape(32.dp))
            .background(if (expanded) GlassFill else GlassFillCollapsed)
            .border(1.dp, GlassStroke, RoundedCornerShape(32.dp))
            .animateContentSize(animationSpec = tween(280))
            .then(if (expanded) Modifier.fillMaxWidth() else Modifier)
            // Consume taps on the bar itself so touches in the gaps between
            // tabs never fall through to the list content behind the glass;
            // when collapsed, tapping the pill expands the bar.
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { if (!expanded) onExpand() },
            )
            .padding(horizontal = 6.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (expanded) {
            navTabs.forEachIndexed { index, tab ->
                TabItem(
                    tab = tab,
                    selected = selected == index,
                    showBadge = index == 1,
                    onClick = { onSelect(index) },
                    modifier = Modifier.weight(1f),
                )
            }
        } else {
            CollapsedTabPill(
                tab = navTabs[selected],
                showBadge = selected != 1,
            )
        }
    }
}

@Composable
private fun CollapsedTabPill(tab: NavTab, showBadge: Boolean) {
    Row(
        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            Icon(
                imageVector = tab.selectedIcon,
                contentDescription = tab.label,
                tint = Indigo,
                modifier = Modifier.size(22.dp),
            )
            if (showBadge) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(7.dp)
                        .background(Danger, CircleShape),
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Text(
            tab.label,
            color = White,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}

@Composable
private fun TabItem(
    tab: NavTab,
    selected: Boolean,
    showBadge: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val tint by animateColorAsState(
        targetValue = if (selected) Indigo else Unselected,
        animationSpec = tween(200),
        label = "tabTint",
    )
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(24.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box {
            Icon(
                imageVector = if (selected) tab.selectedIcon else tab.icon,
                contentDescription = tab.label,
                tint = tint,
                modifier = Modifier.size(24.dp),
            )
            if (showBadge) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 0.dp)
                        .size(8.dp)
                        .background(Danger, CircleShape),
                )
            }
        }
        Spacer(Modifier.height(3.dp))
        Text(
            tab.label,
            color = tint,
            fontSize = 10.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            maxLines = 1,
        )
    }
}

