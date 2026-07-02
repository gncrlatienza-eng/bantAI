package com.bantai.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Message
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.bantai.ui.screens.settings.SettingsScreen
import com.bantai.ui.theme.Black
import com.bantai.viewmodel.SettingsViewModel
import com.bantai.ui.theme.Danger
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.White

private data class NavTab(val label: String, val icon: ImageVector)

private val navTabs = listOf(
    NavTab("Home",      Icons.Filled.Home),
    NavTab("Messages",  Icons.AutoMirrored.Filled.Message),
    NavTab("Alerts",    Icons.Filled.Notifications),
    NavTab("Campaigns", Icons.Filled.Campaign),
    NavTab("Settings",  Icons.Filled.Settings),
)

@Composable
fun MainScreen(navController: NavController, settingsViewModel: SettingsViewModel) {
    var selectedTab by rememberSaveable { mutableStateOf(0) }

    Scaffold(
        modifier = Modifier.fillMaxSize().background(Black),
        containerColor = Black,
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF0D0D0D)) {
                navTabs.forEachIndexed { index, tab ->
                    val selected = selectedTab == index
                    val itemColors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Indigo,
                        selectedTextColor = Indigo,
                        unselectedIconColor = Color(0xFF666666),
                        unselectedTextColor = Color(0xFF666666),
                        indicatorColor = Color.Transparent,
                    )
                    NavigationBarItem(
                        selected = selected,
                        onClick = { selectedTab = index },
                        icon = {
                            if (index == 2) {
                                BadgedBox(badge = {
                                    Badge(containerColor = Danger) {
                                        Text("4", color = White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }
                                }) {
                                    Icon(tab.icon, contentDescription = tab.label)
                                }
                            } else {
                                Icon(tab.icon, contentDescription = tab.label)
                            }
                        },
                        label = {
                            Text(
                                tab.label,
                                fontSize = 10.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        },
                        colors = itemColors,
                    )
                }
            }
        },
    ) { padding ->
        when (selectedTab) {
            0 -> HomeScreen(navController, padding, onNavigateToMessages = { selectedTab = 1 })
            1 -> MessagesScreen(navController, padding)
            2 -> AlertsScreen(navController, padding)
            3 -> CampaignsScreen(navController, padding)
            4 -> SettingsScreen(padding, navController, settingsViewModel)
        }
    }
}
