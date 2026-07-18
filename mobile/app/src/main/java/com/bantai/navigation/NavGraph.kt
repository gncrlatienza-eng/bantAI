package com.bantai.navigation

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bantai.data.local.UserPreferences
import com.bantai.ui.screens.main.BlockedNumbersScreen
import com.bantai.ui.screens.main.CampaignDetailScreen
import com.bantai.ui.screens.main.ComposeScreen
import com.bantai.ui.screens.main.MainScreen
import com.bantai.ui.screens.main.MessageDetailScreen
import com.bantai.ui.screens.main.ReportSentScreen
import com.bantai.ui.screens.main.SmishingAlertScreen
import com.bantai.ui.screens.main.SuspiciousDetailScreen
import com.bantai.ui.screens.main.TakeActionScreen
import com.bantai.ui.screens.main.ThreatAnalysisScreen
import com.bantai.ui.screens.main.UnsafeLinkScreen
import com.bantai.ui.screens.onboarding.OnboardingConfirmNumberScreen
import com.bantai.ui.screens.onboarding.OnboardingDefaultSmsScreen
import com.bantai.ui.screens.onboarding.OnboardingEnterCodeScreen
import com.bantai.ui.screens.onboarding.OnboardingProfileScreen
import com.bantai.ui.screens.onboarding.OnboardingProtectedScreen
import com.bantai.ui.screens.onboarding.SplashScreen
import com.bantai.ui.screens.settings.EditProfileScreen
import com.bantai.ui.screens.settings.HowItWorksScreen
import com.bantai.ui.screens.settings.NotificationsScreen
import com.bantai.ui.screens.settings.PrivacyDataScreen
import com.bantai.ui.screens.settings.ScamAwarenessScreen
import com.bantai.ui.screens.settings.TipDetailScreen
import com.bantai.viewmodel.OnboardingViewModel
import com.bantai.viewmodel.SettingsViewModel
import kotlinx.coroutines.flow.first

// Sealed class kept for main-app screens referenced throughout the codebase
sealed class Screen(val route: String) {
    data object Main : Screen("main")
    data object SuspiciousDetail : Screen("suspicious_detail/{sender}") {
        fun createRoute(sender: String) = "suspicious_detail/${Uri.encode(sender)}"
    }
    data object UnsafeLink : Screen("unsafe_link")
    data object ThreatAnalysis : Screen("threat_analysis")
    data object TakeAction : Screen("take_action")
    data object ReportSent : Screen("report_sent/{type}") {
        fun createRoute(type: String) = "report_sent/$type"
    }
    data object BlockedNumbers : Screen("blocked_numbers")
    data object CampaignDetail : Screen("campaign_detail/{isActive}") {
        fun createRoute(isActive: Boolean) = "campaign_detail/$isActive"
    }
    data object SmishingAlert : Screen("smishing_alert")
    data object Compose : Screen("compose")
    data object SettingsNotifications : Screen("settings/notifications")
    data object SettingsScamAwareness : Screen("settings/scam_awareness")
    data object SettingsTipDetail : Screen("settings/tip/{tip}") {
        fun createRoute(tip: String) = "settings/tip/$tip"
    }
    data object SettingsPrivacy : Screen("settings/privacy")
    data object SettingsEditProfile : Screen("settings/edit_profile")
    data object SettingsHowItWorks : Screen("settings/how_it_works")
    data object Splash : Screen("splash")
    data object OnboardingDefaultSms : Screen("onboarding_default_sms")
    data object OnboardingConfirmNumber : Screen("onboarding_confirm_number")
    data object OnboardingEnterCode : Screen("onboarding_enter_code")
    data object OnboardingProfile : Screen("onboarding_profile")
    data object OnboardingProtected : Screen("onboarding_protected")
    // Stubs retained so orphaned screen files compile — not registered as routes
    data object OnboardingAllowAccess : Screen("onboarding_allow_access")
    data object OnboardingTerms : Screen("onboarding_terms")
    data object Detail : Screen("detail/{sender}") {
        fun createRoute(sender: String) = "detail/${Uri.encode(sender)}"
    }
}

@Composable
fun NavGraph() {
    val navController = rememberNavController()
    val context = LocalContext.current
    val viewModel: OnboardingViewModel = viewModel()
    val settingsViewModel: SettingsViewModel = viewModel()

    var startDestination by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val prefs = UserPreferences(context)
        val userData = prefs.userData.first()
        startDestination = if (userData.onboardingComplete) "main" else "splash"
    }

    if (startDestination == null) {
        Box(modifier = Modifier.fillMaxSize().background(Color.Black))
        return
    }

    NavHost(
        navController = navController,
        startDestination = startDestination!!,
    ) {
        composable("splash") {
            SplashScreen(onFinished = {
                navController.navigate("onboarding_default_sms") {
                    popUpTo("splash") { inclusive = true }
                }
            })
        }

        composable("onboarding_default_sms") {
            OnboardingDefaultSmsScreen(onNext = {
                navController.navigate("onboarding_confirm_number")
            })
        }

        composable("onboarding_confirm_number") {
            OnboardingConfirmNumberScreen(
                navController = navController,
                viewModel = viewModel,
            )
        }

        composable("onboarding_enter_code") {
            OnboardingEnterCodeScreen(
                navController = navController,
                viewModel = viewModel,
            )
        }

        composable("onboarding_profile") {
            OnboardingProfileScreen(
                viewModel = viewModel,
                onNext = { navController.navigate("onboarding_protected") },
            )
        }

        composable("onboarding_protected") {
            OnboardingProtectedScreen(
                viewModel = viewModel,
                onFinish = {
                    navController.navigate("main") {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }

        composable("main") {
            MainScreen(navController, settingsViewModel)
        }

        // Main app sub-screens
        composable(
            route = Screen.SuspiciousDetail.route,
            arguments = listOf(navArgument("sender") { type = NavType.StringType }),
        ) { backStackEntry ->
            val sender = backStackEntry.arguments?.getString("sender") ?: ""
            SuspiciousDetailScreen(sender = sender, navController = navController)
        }
        composable(Screen.UnsafeLink.route) { UnsafeLinkScreen(navController) }
        composable(Screen.ThreatAnalysis.route) { ThreatAnalysisScreen(navController) }
        composable(Screen.TakeAction.route) { TakeActionScreen(navController) }
        composable(
            route = Screen.ReportSent.route,
            arguments = listOf(navArgument("type") { type = NavType.StringType }),
        ) { backStackEntry ->
            val type = backStackEntry.arguments?.getString("type") ?: "report_only"
            ReportSentScreen(type = type, navController = navController)
        }
        composable(Screen.BlockedNumbers.route) { BlockedNumbersScreen(navController) }
        composable(
            route = Screen.CampaignDetail.route,
            arguments = listOf(navArgument("isActive") { type = NavType.BoolType }),
        ) { backStackEntry ->
            val isActive = backStackEntry.arguments?.getBoolean("isActive") ?: true
            CampaignDetailScreen(isActive = isActive, navController = navController)
        }
        composable(Screen.SmishingAlert.route) { SmishingAlertScreen(navController) }
        composable(Screen.Compose.route) { ComposeScreen(navController) }
        composable(Screen.SettingsNotifications.route) { NotificationsScreen(navController, settingsViewModel) }
        composable(Screen.SettingsEditProfile.route) { EditProfileScreen(navController, settingsViewModel) }
        composable(Screen.SettingsHowItWorks.route) { HowItWorksScreen(navController) }
        composable(Screen.SettingsScamAwareness.route) { ScamAwarenessScreen(navController) }
        composable(
            route = Screen.SettingsTipDetail.route,
            arguments = listOf(navArgument("tip") { type = NavType.StringType }),
        ) { backStackEntry ->
            val tip = backStackEntry.arguments?.getString("tip") ?: ""
            TipDetailScreen(tip = tip, navController = navController)
        }
        composable(Screen.SettingsPrivacy.route) { PrivacyDataScreen(navController) }
        composable(
            route = Screen.Detail.route,
            arguments = listOf(navArgument("sender") { type = NavType.StringType }),
        ) { backStackEntry ->
            val sender = backStackEntry.arguments?.getString("sender") ?: return@composable
            MessageDetailScreen(sender = sender, navController = navController)
        }
    }
}
