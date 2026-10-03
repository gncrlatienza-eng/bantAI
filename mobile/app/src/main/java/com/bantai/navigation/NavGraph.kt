package com.bantai.navigation

import android.net.Uri
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bantai.container
import com.bantai.data.AuthEventBus
import com.bantai.data.model.ConversationView
import com.bantai.ui.components.FloatingTabBar
import com.bantai.ui.components.LaunchScreen
import com.bantai.ui.components.LocalBottomBarClearance
import com.bantai.ui.components.SCAM_WAVES_TAB_ID
import com.bantai.ui.components.tabBarHeight
import com.bantai.ui.screens.main.BlockedNumbersScreen
import com.bantai.ui.screens.main.CampaignDetailScreen
import com.bantai.ui.screens.main.ComposeScreen
import com.bantai.ui.screens.main.MainScreen
import com.bantai.ui.screens.main.MessageDetailScreen
import com.bantai.ui.screens.main.ReportDetailScreen
import com.bantai.ui.screens.main.ReportSentScreen
import com.bantai.ui.screens.main.ScamWaveScreen
import com.bantai.ui.screens.main.SenderReportsScreen
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
import com.bantai.ui.screens.onboarding.WelcomeScreen
import com.bantai.ui.screens.settings.EditProfileScreen
import com.bantai.ui.screens.settings.HowItWorksScreen
import com.bantai.ui.screens.settings.NotificationsScreen
import com.bantai.ui.screens.settings.PrivacyDataScreen
import com.bantai.ui.screens.settings.ScamAwarenessScreen
import com.bantai.ui.screens.settings.TipDetailScreen
import com.bantai.ui.theme.Black
import com.bantai.ui.theme.GlassFill
import com.bantai.viewmodel.AlertsViewModel
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

    // localId (the device SMS row) lets any message be reported even before the
    // backend has seen it; label (Ham/Spam/Scam, blank if unsure) hides the
    // report option that would just repeat the current verdict. action
    // ("report" / "block", blank for neither) preselects that option when the
    // caller already knows which one the user picked (the thread's menu).
    // canBlock=false hides Block: a trusted sender name (blocking "BDO" would
    // also block the real bank -- names are spoofable) or an already-blocked one.
    // localIds: several device SMS rows from one thread, selected and reported
    // together (one groupId); takes the place of localId when set.
    data object TakeAction : Screen(
        "take_action?messageId={messageId}&sender={sender}&localId={localId}&label={label}&action={action}" +
            "&canBlock={canBlock}&localIds={localIds}",
    ) {
        @Suppress("LongParameterList") // one per route argument, all optional
        fun createRoute(
            messageId: String = "",
            sender: String = "",
            localId: Long? = null,
            currentLabel: String = "",
            action: String = "",
            canBlock: Boolean = true,
            localIds: Collection<Long> = emptyList(),
        ) = "take_action?messageId=${Uri.encode(messageId)}&sender=${Uri.encode(sender)}" +
            "&localId=${localId ?: ""}&label=${Uri.encode(currentLabel)}&action=${Uri.encode(action)}" +
            "&canBlock=$canBlock&localIds=${localIds.joinToString(",")}"
    }

    data object ReportSent : Screen("report_sent/{type}") {
        fun createRoute(type: String) = "report_sent/$type"
    }

    data object BlockedNumbers : Screen("blocked_numbers")

    data object CampaignDetail : Screen("campaign_detail/{campaignId}") {
        fun createRoute(campaignId: String) = "campaign_detail/${Uri.encode(campaignId)}"
    }

    data object ScamWave : Screen("scam_wave/{waveKey}?tip={tip}") {
        fun createRoute(
            waveKey: String,
            tip: String?,
        ) = "scam_wave/${Uri.encode(waveKey)}" + (tip?.let { "?tip=${Uri.encode(it)}" } ?: "")

        fun createRoute(waveKey: String) = "scam_wave/${Uri.encode(waveKey)}"
    }

    data object SmishingAlert : Screen("smishing_alert/{messageId}") {
        fun createRoute(messageId: String) = "smishing_alert/${Uri.encode(messageId)}"
    }

    /** One report from Alerts -> Reported; [key] is its groupId, or its message id. */
    data object ReportDetail : Screen("report_detail/{key}") {
        fun createRoute(key: String) = "report_detail/${Uri.encode(key)}"
    }

    /** Every report about one sender under Reported's current filter; [key] is AlertSections.senderKey. */
    data object SenderReports : Screen("sender_reports/{key}") {
        fun createRoute(key: String) = "sender_reports/${Uri.encode(key)}"
    }

    data object Compose : Screen("compose?recipient={recipient}&body={body}") {
        fun createRoute(
            recipient: String = "",
            body: String = "",
        ) = "compose?recipient=${Uri.encode(recipient)}&body=${Uri.encode(body)}"
    }

    data object SettingsNotifications : Screen("settings/notifications")

    data object SettingsScamAwareness : Screen("settings/scam_awareness?tip={tip}") {
        fun createRoute(tip: String? = null) = "settings/scam_awareness" + (tip?.let { "?tip=${Uri.encode(it)}" } ?: "")
    }

    data object SettingsTipDetail : Screen("settings/tip/{tip}") {
        fun createRoute(tip: String) = "settings/tip/$tip"
    }

    data object SettingsPrivacy : Screen("settings/privacy")

    data object SettingsEditProfile : Screen("settings/edit_profile")

    data object SettingsHowItWorks : Screen("settings/how_it_works")

    data object Splash : Screen("splash")

    data object Welcome : Screen("welcome")

    data object SignIn : Screen("sign_in")

    data object OnboardingDefaultSms : Screen("onboarding_default_sms")

    data object OnboardingConfirmNumber : Screen("onboarding_confirm_number")

    data object OnboardingEnterCode : Screen("onboarding_enter_code")

    data object OnboardingProfile : Screen("onboarding_profile")

    data object OnboardingProtected : Screen("onboarding_protected")

    data object OnboardingAllowAccess : Screen("onboarding_allow_access")

    data object OnboardingTerms : Screen("onboarding_terms")

    // view is optional: notifications and Compose open the full thread, while
    // the inbox chips open only their slice (see ConversationView).
    // highlight: device SMS row ids to scroll to and glow -- the messages a
    // Reported entry stands for, or the ones just reported.
    data object Detail : Screen("detail/{sender}?view={view}&highlight={highlight}") {
        fun createRoute(
            sender: String,
            view: ConversationView = ConversationView.ALL,
            highlight: Collection<Long> = emptyList(),
        ) = "detail/${Uri.encode(sender)}?view=${view.routeValue}&highlight=${highlight.joinToString(",")}"
    }
}

private const val SCREEN_TRANSITION_MS = 320
private const val SCREEN_SLIDE_OFFSET_DIVISOR = 5

// Bottom system bar taller than this means 3-button navigation (~48dp);
// gesture navigation's handle is ~16-24dp.
private val THREE_BUTTON_NAV_MIN_HEIGHT = 32.dp

// Gap between the floating pill and the bottom of the screen.
private val FLOATING_BAR_MARGIN = 12.dp

// Breathing room between the last row of a list and the bar above it.
private val CONTENT_BOTTOM_GAP = 16.dp

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
        Screen.ReportDetail.route,
        Screen.SenderReports.route,
        Screen.ScamWave.route,
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
        navArgument("localId") {
            type = NavType.StringType
            defaultValue = ""
        },
        navArgument("label") {
            type = NavType.StringType
            defaultValue = ""
        },
        navArgument("action") {
            type = NavType.StringType
            defaultValue = ""
        },
        navArgument("canBlock") {
            type = NavType.BoolType
            defaultValue = true
        },
        navArgument("localIds") {
            type = NavType.StringType
            defaultValue = ""
        },
    )

// "12,15,19" -> [12, 15, 19]; the list route arguments above.

/** A safety tip to open from its notification; [waveKey] set for a campaign tip. */
data class RequestedTip(
    val tipId: String,
    val waveKey: String?,
)

private fun idList(raw: String?): List<Long> = raw.orEmpty().split(",").mapNotNull { it.trim().toLongOrNull() }

@Composable
@Suppress("LongMethod", "CyclomaticComplexMethod") // the app's one route table, kept in one place
fun NavGraph(
    requestedTab: Int? = null,
    requestedConversationSender: String? = null,
    requestedTip: RequestedTip? = null,
    requestedComposeRecipient: String? = null,
    requestedComposeBody: String = "",
) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val viewModel: OnboardingViewModel = viewModel()
    val settingsViewModel: SettingsViewModel = viewModel()

    // Hoisted to the navigation root (not MainScreen) so the floating tab bar
    // can show the Alerts count, and one poller serves both.
    val alertsViewModel: AlertsViewModel = viewModel()
    val unseenAlerts by alertsViewModel.unseenCount.collectAsState()

    var startDestination by remember { mutableStateOf<String?>(null) }

    // Hoisted here (rather than inside MainScreen) so the floating tab bar can
    // be rendered once at the navigation root and persist across browsing
    // sub-screens (alert detail, campaign detail, settings pages...), not
    // just the four main tabs themselves.
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    val hazeState = remember { HazeState() }

    // Settings → "Show Scam Waves tab". Turning it off while on that tab
    // falls back to Messages rather than leaving a tab with no button.
    val showScamWaves by settingsViewModel.showScamWavesTab.collectAsState()
    LaunchedEffect(showScamWaves) {
        if (!showScamWaves && selectedTab == SCAM_WAVES_TAB_ID) selectedTab = 0
    }

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
                context.container.userPreferences.userData
                    .first()
            }
        // onboardingComplete alone isn't "logged in" -- the token can be cleared
        // independently (e.g. the 401 handler below) while that flag stays true.
        // Route straight back to re-authentication in that case rather than
        // rendering "main" with no valid session (which would then just 401 on
        // every call and bounce here anyway, only after a beat on a dead screen).
        startDestination =
            when {
                userData.onboardingComplete && userData.authToken.isNotEmpty() -> "main"
                // Signed out on a phone that's already set up: the landing page,
                // like Telegram/WhatsApp after logging out.
                userData.onboardingComplete -> Screen.Welcome.route
                else -> "splash"
            }
    }

    // A 401 from any backend call means the stored token is dead. Without this,
    // nothing ever clears it or gives the user a way back to re-authenticate —
    // every call just keeps failing the same generic way forever.
    LaunchedEffect(Unit) {
        AuthEventBus.sessionExpired.collect {
            context.container.userPreferences.clearAuthToken()
            navController.navigate(Screen.Welcome.route) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    // Same logo frame as the launch window until the first screen is known.
    if (startDestination == null) {
        LaunchScreen()
        return
    }

    val topBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = topBackStackEntry?.destination?.route
    val showBottomBar = currentRoute in BOTTOM_BAR_ROUTES

    // Gesture navigation leaves only a thin handle (~16-24dp) at the bottom;
    // 3-button navigation is a ~48dp row. On the latter the floating pill
    // would stack on the buttons, so the bar docks to the edge instead.
    val systemNavHeight = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val dockedTabBar = systemNavHeight > THREE_BUTTON_NAV_MIN_HEIGHT
    val bottomBarClearance =
        when {
            !showBottomBar -> systemNavHeight + CONTENT_BOTTOM_GAP
            dockedTabBar -> tabBarHeight(docked = true) + systemNavHeight + CONTENT_BOTTOM_GAP
            else -> tabBarHeight(docked = false) + FLOATING_BAR_MARGIN + systemNavHeight + CONTENT_BOTTOM_GAP
        }

    CompositionLocalProvider(LocalBottomBarClearance provides bottomBarClearance) {
        Box(modifier = Modifier.fillMaxSize().background(Black)) {
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
                    // Onboarding order: Terms first (consent before any data is
                    // collected), then email + code, then the phone permissions
                    // once the user knows what BantAI is, then the profile. It used
                    // to open on "make BantAI your default SMS app" before anything
                    // was explained, with Terms only after SMS access and email.
                    composable("splash") {
                        SplashScreen(onFinished = {
                            navController.navigate(Screen.Welcome.route) {
                                popUpTo("splash") { inclusive = true }
                            }
                        })
                    }

                    composable(Screen.Welcome.route) {
                        WelcomeScreen(
                            onCreateAccount = {
                                viewModel.signingIn = false
                                navController.navigate("onboarding_terms")
                            },
                            onSignIn = {
                                viewModel.signingIn = true
                                navController.navigate(Screen.SignIn.route)
                            },
                        )
                    }

                    // "I already have an account" on the Welcome page.
                    composable(Screen.SignIn.route) {
                        LaunchedEffect(Unit) { viewModel.signingIn = true }
                        OnboardingConfirmNumberScreen(
                            navController = navController,
                            viewModel = viewModel,
                            signIn = true,
                            onCreateAccount = {
                                viewModel.signingIn = false
                                navController.navigate("onboarding_terms")
                            },
                        )
                    }

                    composable("onboarding_default_sms") {
                        OnboardingDefaultSmsScreen(onNext = {
                            navController.navigate("onboarding_allow_access")
                        })
                    }

                    composable("onboarding_allow_access") {
                        OnboardingAllowAccessScreen(onNext = {
                            // Signing in to an account that already has a name skips
                            // the name step. Popped so Back doesn't land on a screen
                            // that skips itself straight forward again.
                            val next =
                                if (viewModel.signingIn && viewModel.firstName.value.isNotBlank()) {
                                    "onboarding_protected"
                                } else {
                                    "onboarding_profile"
                                }
                            navController.navigate(next) {
                                popUpTo("onboarding_allow_access") { inclusive = true }
                            }
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
                        MainScreen(navController, settingsViewModel, alertsViewModel, selectedTab = selectedTab)
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
                            localMessageId = backStackEntry.arguments?.getString("localId")?.toLongOrNull(),
                            currentLabel = backStackEntry.arguments?.getString("label") ?: "",
                            preselect = backStackEntry.arguments?.getString("action") ?: "",
                            canBlock = backStackEntry.arguments?.getBoolean("canBlock") ?: true,
                            localMessageIds = idList(backStackEntry.arguments?.getString("localIds")),
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
                        route = Screen.ScamWave.route,
                        arguments =
                            listOf(
                                navArgument("waveKey") { type = NavType.StringType },
                                navArgument("tip") {
                                    type = NavType.StringType
                                    nullable = true
                                    defaultValue = null
                                },
                            ),
                    ) { backStackEntry ->
                        val waveKey = backStackEntry.arguments?.getString("waveKey") ?: return@composable
                        ScamWaveScreen(
                            waveKey = waveKey,
                            navController = navController,
                            openTipId = backStackEntry.arguments?.getString("tip"),
                        )
                    }
                    composable(
                        route = Screen.SmishingAlert.route,
                        arguments = listOf(navArgument("messageId") { type = NavType.StringType }),
                    ) { backStackEntry ->
                        val messageId = backStackEntry.arguments?.getString("messageId") ?: return@composable
                        SmishingAlertScreen(messageId = messageId, navController = navController)
                    }
                    composable(
                        route = Screen.ReportDetail.route,
                        arguments = listOf(navArgument("key") { type = NavType.StringType }),
                    ) { backStackEntry ->
                        val key = backStackEntry.arguments?.getString("key") ?: return@composable
                        ReportDetailScreen(
                            reportKey = key,
                            navController = navController,
                            alertsViewModel = alertsViewModel,
                        )
                    }
                    composable(
                        route = Screen.SenderReports.route,
                        arguments = listOf(navArgument("key") { type = NavType.StringType }),
                    ) { backStackEntry ->
                        val key = backStackEntry.arguments?.getString("key") ?: return@composable
                        SenderReportsScreen(
                            senderKey = key,
                            navController = navController,
                            alertsViewModel = alertsViewModel,
                        )
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
                    composable(Screen.SettingsNotifications.route) {
                        NotificationsScreen(
                            navController,
                            settingsViewModel,
                        )
                    }
                    composable(Screen.SettingsEditProfile.route) { EditProfileScreen(navController, settingsViewModel) }
                    composable(Screen.SettingsHowItWorks.route) { HowItWorksScreen(navController) }
                    composable(
                        route = Screen.SettingsScamAwareness.route,
                        arguments =
                            listOf(
                                navArgument("tip") {
                                    type = NavType.StringType
                                    nullable = true
                                    defaultValue = null
                                },
                            ),
                    ) { entry ->
                        ScamAwarenessScreen(navController, openTipId = entry.arguments?.getString("tip"))
                    }
                    composable(
                        route = Screen.SettingsTipDetail.route,
                        arguments = listOf(navArgument("tip") { type = NavType.StringType }),
                    ) { backStackEntry ->
                        val tip = backStackEntry.arguments?.getString("tip") ?: ""
                        TipDetailScreen(tip = tip, navController = navController)
                    }
                    composable(Screen.SettingsPrivacy.route) { PrivacyDataScreen(navController, settingsViewModel) }
                    composable(
                        route = Screen.Detail.route,
                        arguments =
                            listOf(
                                navArgument("sender") { type = NavType.StringType },
                                navArgument("view") {
                                    type = NavType.StringType
                                    defaultValue = ConversationView.ALL.routeValue
                                },
                                navArgument("highlight") {
                                    type = NavType.StringType
                                    defaultValue = ""
                                },
                            ),
                    ) { backStackEntry ->
                        val sender = backStackEntry.arguments?.getString("sender") ?: return@composable
                        MessageDetailScreen(
                            sender = sender,
                            navController = navController,
                            initialView = ConversationView.fromRoute(backStackEntry.arguments?.getString("view")),
                            highlightIds = idList(backStackEntry.arguments?.getString("highlight")).toSet(),
                        )
                    }
                }
            }

            if (showBottomBar) {
                val onSelectTab: (Int) -> Unit = { index ->
                    selectedTab = index
                    // Back to the tabs from any browsing sub-screen: pop down to
                    // the existing "main" entry (which keeps each tab's state)
                    // rather than re-creating it; navigate only if it's gone.
                    if (currentRoute != "main" && !navController.popBackStack("main", inclusive = false)) {
                        navController.navigate("main") { launchSingleTop = true }
                    }
                }
                if (dockedTabBar) {
                    // Edge to edge, with the same glass fill running down behind the
                    // system buttons so bar and buttons read as one surface.
                    Column(
                        modifier =
                            Modifier
                                .align(Alignment.BottomCenter)
                                .fillMaxWidth()
                                .background(GlassFill),
                    ) {
                        FloatingTabBar(
                            selected = selectedTab,
                            alertsBadge = unseenAlerts,
                            hazeState = hazeState,
                            docked = true,
                            showScamWaves = showScamWaves,
                            onSelect = onSelectTab,
                        )
                        Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.navigationBars))
                    }
                } else {
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.BottomCenter)
                                .navigationBarsPadding()
                                .padding(horizontal = 24.dp)
                                .padding(bottom = FLOATING_BAR_MARGIN)
                                .fillMaxWidth(),
                        contentAlignment = Alignment.Center,
                    ) {
                        FloatingTabBar(
                            selected = selectedTab,
                            alertsBadge = unseenAlerts,
                            hazeState = hazeState,
                            showScamWaves = showScamWaves,
                            onSelect = onSelectTab,
                        )
                    }
                }
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
    // A tapped safety-tip notification (trusted by MainActivity) opens the tip:
    // in its Scam Wave for a campaign tip, else in Scam Awareness.
    LaunchedEffect(requestedTip) {
        val tip = requestedTip ?: return@LaunchedEffect
        navController.navigate(
            tip.waveKey?.let { Screen.ScamWave.createRoute(it, tip.tipId) }
                ?: Screen.SettingsScamAwareness.createRoute(tip.tipId),
        )
    }

    LaunchedEffect(requestedConversationSender) {
        val sender = requestedConversationSender ?: return@LaunchedEffect
        val conversationExists =
            withContext(Dispatchers.IO) {
                context.container.smsRepository
                    .getConversationBySender(sender, limit = 1)
                    .isNotEmpty()
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
