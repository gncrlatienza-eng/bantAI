package com.bantai.navigation

import android.net.Uri
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bantai.data.AuthEventBus
import com.bantai.data.SmsRepository
import com.bantai.data.local.UserPreferences
import com.bantai.ui.components.FloatingTabBar
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
import com.bantai.ui.screens.onboarding.OnboardingAllowAccessScreen
import com.bantai.ui.screens.onboarding.OnboardingConfirmNumberScreen
import com.bantai.ui.screens.onboarding.OnboardingDefaultSmsScreen
import com.bantai.ui.screens.onboarding.OnboardingEnterCodeScreen
import com.bantai.ui.screens.onboarding.OnboardingProfileScreen
import com.bantai.ui.screens.onboarding.OnboardingProtectedScreen
import com.bantai.ui.screens.onboarding.OnboardingTermsScreen
import com.bantai.ui.screens.onboarding.SplashScreen
import com.bantai.ui.screens.settings.EditProfileScreen
import com.bantai.ui.screens.settings.HowItWorksScreen
import com.bantai.ui.screens.settings.NotificationsScreen
import com.bantai.ui.screens.settings.PrivacyDataScreen
import com.bantai.ui.screens.settings.ScamAwarenessScreen
import com.bantai.ui.screens.settings.TipDetailScreen
import com.bantai.viewmodel.OnboardingViewModel
import com.bantai.viewmodel.SettingsViewModel
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext

// Sealed class kept for main-app screens referenced throughout the codebase
sealed class Screen(
    val route: String,
) {
    data object Main : Screen("main")

    data object SuspiciousDetail : Screen("suspicious_detail/{sender}") {
        fun createRoute(sender: String) = "suspicious_detail/${Uri.encode(sender)}"
    }

    data object UnsafeLink : Screen("unsafe_link")

    // messageId is an optional query arg, not a required path segment: the AI-summary
    // shortcut and suspicious-thread banner in MessageDetailScreen/SuspiciousDetailScreen
    // navigate here with no specific message tracked, alongside AlertsScreen's real one.
    data object ThreatAnalysis : Screen("threat_analysis?messageId={messageId}") {
        fun createRoute(messageId: String = "") = "threat_analysis?messageId=${Uri.encode(messageId)}"
    }

    data object TakeAction : Screen("take_action?messageId={messageId}&sender={sender}") {
        fun createRoute(
            messageId: String = "",
            sender: String = "",
        ) = "take_action?messageId=${Uri.encode(messageId)}&sender=${Uri.encode(sender)}"
    }

    data object ReportSent : Screen("report_sent/{type}") {
        fun createRoute(type: String) = "report_sent/$type"
    }

    data object BlockedNumbers : Screen("blocked_numbers")

    data object CampaignDetail : Screen("campaign_detail/{campaignId}") {
        fun createRoute(campaignId: String) = "campaign_detail/${Uri.encode(campaignId)}"
    }

    data object SmishingAlert : Screen("smishing_alert/{messageId}") {
        fun createRoute(messageId: String) = "smishing_alert/${Uri.encode(messageId)}"
    }

    data object Compose : Screen("compose?recipient={recipient}&body={body}") {
        fun createRoute(
            recipient: String = "",
            body: String = "",
        ) = "compose?recipient=${Uri.encode(recipient)}&body=${Uri.encode(body)}"
    }

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

    data object OnboardingAllowAccess : Screen("onboarding_allow_access")

    data object OnboardingTerms : Screen("onboarding_terms")

    data object Detail : Screen("detail/{sender}") {
        fun createRoute(sender: String) = "detail/${Uri.encode(sender)}"
    }
}

private const val SCREEN_TRANSITION_MS = 320
private const val SCREEN_SLIDE_OFFSET_DIVISOR = 5

// Routes where the floating tab bar persists -- the four main tabs plus the
// "browsing" screens reachable from them. Deliberately excludes flow/modal
// screens (Compose, TakeAction, ReportSent, UnsafeLink) and the message
// thread (it has its own docked reply bar, so stacking a second floating bar
// on top of that would just collide -- same reason the stock iOS Messages
// app itself hides its tab bar inside a conversation).
private val BOTTOM_BAR_ROUTES =
    setOf(
        "main",
        Screen.SmishingAlert.route,
        Screen.CampaignDetail.route,
        Screen.SettingsNotifications.route,
        Screen.SettingsEditProfile.route,
        Screen.SettingsHowItWorks.route,
        Screen.SettingsScamAwareness.route,
        Screen.SettingsTipDetail.route,
        Screen.SettingsPrivacy.route,
    )

// Hoisted out of NavGraph() so the nested navArgument{} builder lambdas don't
// count toward that function's own cyclomatic complexity.
private val takeActionArguments =
    listOf(
        navArgument("messageId") {
            type = NavType.StringType
            defaultValue = ""
        },
        navArgument("sender") {
            type = NavType.StringType
            defaultValue = ""
        },
    )

@Composable
fun NavGraph(
    requestedTab: Int? = null,
    requestedConversationSender: String? = null,
    requestedComposeRecipient: String? = null,
    requestedComposeBody: String = "",
) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val viewModel: OnboardingViewModel = viewModel()
    val settingsViewModel: SettingsViewModel = viewModel()

    var startDestination by remember { mutableStateOf<String?>(null) }

    // Hoisted here (rather than inside MainScreen) so the floating tab bar can
    // be rendered once at the navigation root and persist across browsing
    // sub-screens (alert detail, campaign detail, settings pages...), not
    // just the four main tabs themselves.
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    val hazeState = remember { HazeState() }

    // Jumps to the requested tab on cold start from a notification tap, and again
    // whenever a new notification is tapped while the app is already running.
    LaunchedEffect(requestedTab) {
        if (requestedTab != null) selectedTab = requestedTab
    }

    LaunchedEffect(Unit) {
        // SecureTokenStore's first read does synchronous Keystore/crypto I/O
        // (EncryptedSharedPreferences.create() + getString()) -- off the main
        // thread here so that work (and this LaunchedEffect otherwise running on
        // Compose's Main dispatcher) never blocks the first frame.
        val userData =
            withContext(Dispatchers.IO) {
                UserPreferences(context).userData.first()
            }
        // onboardingComplete alone isn't "logged in" -- the token can be cleared
        // independently (e.g. the 401 handler below) while that flag stays true.
        // Route straight back to re-authentication in that case rather than
        // rendering "main" with no valid session (which would then just 401 on
        // every call and bounce here anyway, only after a beat on a dead screen).
        startDestination =
            when {
                userData.onboardingComplete && userData.authToken.isNotEmpty() -> "main"
                userData.onboardingComplete -> "onboarding_confirm_number"
                else -> "splash"
            }
    }

    // A 401 from any backend call means the stored token is dead. Without this,
    // nothing ever clears it or gives the user a way back to re-authenticate —
    // every call just keeps failing the same generic way forever.
    LaunchedEffect(Unit) {
        AuthEventBus.sessionExpired.collect {
            UserPreferences(context).clearAuthToken()
            navController.navigate("onboarding_confirm_number") {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    if (startDestination == null) {
        Box(modifier = Modifier.fillMaxSize().background(Color.Black))
        return
    }

    val topBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = topBackStackEntry?.destination?.route
    val showBottomBar = currentRoute in BOTTOM_BAR_ROUTES

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        // Shared between the screen content (the blur source) and the pill (the
        // blurred surface) -- Haze reads whatever's been drawn to this state's
        // source(s) each frame the pill is on top of them. Wraps the whole
        // NavHost (not just one screen) so the pill glassifies whatever
        // browsing screen happens to be behind it.
        Box(modifier = Modifier.fillMaxSize().hazeSource(hazeState)) {
            NavHost(
                navController = navController,
                startDestination = startDestination!!,
                modifier = Modifier.fillMaxSize(),
                enterTransition = {
                    slideInHorizontally(
                        initialOffsetX = { it / SCREEN_SLIDE_OFFSET_DIVISOR },
                        animationSpec = tween(SCREEN_TRANSITION_MS),
                    ) + fadeIn(animationSpec = tween(SCREEN_TRANSITION_MS))
                },
                exitTransition = {
                    slideOutHorizontally(
                        targetOffsetX = { -it / SCREEN_SLIDE_OFFSET_DIVISOR },
                        animationSpec = tween(SCREEN_TRANSITION_MS),
                    ) + fadeOut(animationSpec = tween(SCREEN_TRANSITION_MS))
                },
                popEnterTransition = {
                    slideInHorizontally(
                        initialOffsetX = { -it / SCREEN_SLIDE_OFFSET_DIVISOR },
                        animationSpec = tween(SCREEN_TRANSITION_MS),
                    ) + fadeIn(animationSpec = tween(SCREEN_TRANSITION_MS))
                },
                popExitTransition = {
                    slideOutHorizontally(
                        targetOffsetX = { it / SCREEN_SLIDE_OFFSET_DIVISOR },
                        animationSpec = tween(SCREEN_TRANSITION_MS),
                    ) + fadeOut(animationSpec = tween(SCREEN_TRANSITION_MS))
                },
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
                        navController.navigate("onboarding_allow_access")
                    })
                }

                composable("onboarding_allow_access") {
                    OnboardingAllowAccessScreen(onNext = {
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

                composable("onboarding_terms") {
                    OnboardingTermsScreen(
                        navController = navController,
                        viewModel = viewModel,
                    )
                }

                composable("onboarding_profile") {
                    OnboardingProfileScreen(
                        navController = navController,
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
                    MainScreen(navController, settingsViewModel, selectedTab = selectedTab)
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
                composable(
                    route = Screen.ThreatAnalysis.route,
                    arguments =
                        listOf(
                            navArgument("messageId") {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) { backStackEntry ->
                    val messageId = backStackEntry.arguments?.getString("messageId") ?: ""
                    ThreatAnalysisScreen(messageId = messageId, navController = navController)
                }
                composable(
                    route = Screen.TakeAction.route,
                    arguments = takeActionArguments,
                ) { backStackEntry ->
                    TakeActionScreen(
                        navController = navController,
                        messageId = backStackEntry.arguments?.getString("messageId") ?: "",
                        sender = backStackEntry.arguments?.getString("sender") ?: "",
                    )
                }
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
                    arguments = listOf(navArgument("campaignId") { type = NavType.StringType }),
                ) { backStackEntry ->
                    val campaignId = backStackEntry.arguments?.getString("campaignId") ?: return@composable
                    CampaignDetailScreen(campaignId = campaignId, navController = navController)
                }
                composable(
                    route = Screen.SmishingAlert.route,
                    arguments = listOf(navArgument("messageId") { type = NavType.StringType }),
                ) { backStackEntry ->
                    val messageId = backStackEntry.arguments?.getString("messageId") ?: return@composable
                    SmishingAlertScreen(messageId = messageId, navController = navController)
                }
                composable(
                    route = Screen.Compose.route,
                    arguments =
                        listOf(
                            navArgument("recipient") {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                            navArgument("body") {
                                type = NavType.StringType
                                defaultValue = ""
                            },
                        ),
                ) { backStackEntry ->
                    ComposeScreen(
                        navController = navController,
                        initialRecipient = backStackEntry.arguments?.getString("recipient") ?: "",
                        initialBody = backStackEntry.arguments?.getString("body") ?: "",
                    )
                }
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

        if (showBottomBar) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(horizontal = 24.dp)
                        .padding(bottom = 12.dp)
                        .fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                FloatingTabBar(
                    selected = selectedTab,
                    hazeState = hazeState,
                    onSelect = { index ->
                        selectedTab = index
                        if (currentRoute != "main") {
                            navController.navigate("main") {
                                popUpTo("main") { inclusive = true }
                                launchSingleTop = true
                            }
                        }
                    },
                )
            }
        }
    }

    // A failed-send notification deep-links straight into that conversation rather
    // than just the Messages tab — fires once the graph above is actually up.
    // MainActivity is necessarily exported (it's the launcher), so this extra can
    // come from any intent, not just our own notification — confirm a matching
    // conversation actually exists before navigating, rather than trusting it
    // blindly and opening an arbitrary/empty thread a malicious co-installed app
    // asked for.
    LaunchedEffect(requestedConversationSender) {
        val sender = requestedConversationSender ?: return@LaunchedEffect
        val conversationExists =
            withContext(Dispatchers.IO) {
                SmsRepository(context).getConversationBySender(sender, limit = 1).isNotEmpty()
            }
        if (conversationExists) {
            navController.navigate(Screen.Detail.createRoute(sender))
        }
    }

    // An sms:/smsto: intent from another app (Contacts, Dialer's "Message"
    // action, etc. -- see MainActivity.resolveComposeRequest) opens Compose
    // pre-filled with that recipient/body, the same way every other SMS app on
    // Android handles this intent shape. No existence check is needed here
    // (unlike requestedConversationSender above) -- Compose already validates
    // an arbitrary recipient itself before allowing a send.
    LaunchedEffect(requestedComposeRecipient) {
        val recipient = requestedComposeRecipient ?: return@LaunchedEffect
        navController.navigate(Screen.Compose.createRoute(recipient, requestedComposeBody))
    }
}
