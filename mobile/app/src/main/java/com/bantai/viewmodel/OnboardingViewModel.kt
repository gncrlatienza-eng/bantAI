package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import com.bantai.container
import com.bantai.data.LocalAccountData
import com.bantai.data.local.UserData
import com.bantai.data.remote.AuthApi
import com.bantai.data.remote.toUserMessage
import com.bantai.util.isValidName
import com.bantai.util.normalizePhNumber
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// Client-side abuse-prevention only, defense-in-depth on top of whatever
// the backend enforces server-side -- this just stops the UI from firing OTP
// request/verify calls as fast as a user (or a script driving the same flow)
// can tap.
private const val RESEND_COOLDOWN_MS = 30_000L
private const val MAX_VERIFY_ATTEMPTS_BEFORE_LOCKOUT = 5
private const val VERIFY_LOCKOUT_MS = 30_000L

// Survive process death on the code-entry screen (audit ANDROID-03). Only the
// number and resend deadline are kept -- never the OTP itself.
private const val SAVED_PHONE = "onboarding_phone"
private const val SAVED_RESEND_AT = "onboarding_resend_at_ms"
private const val SESSION_EXPIRED_MESSAGE = "Verification session expired. Go back and enter your number again."

data class OnboardingUiState(
    val phoneNumber: String = "",
    val termsAccepted: Boolean = false,
    val otpCode: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val resendAvailableAtMs: Long = 0L,
    val failedVerifyAttempts: Int = 0,
    val verifyLockedUntilMs: Long = 0L,
)

class OnboardingViewModel(
    application: Application,
    private val savedState: SavedStateHandle,
) : AndroidViewModel(application) {
    private val userPreferences = application.container.userPreferences

    private val _userData = MutableStateFlow(UserData())
    val userData: StateFlow<UserData> = _userData.asStateFlow()

    private val _firstName = MutableStateFlow("")
    val firstName: StateFlow<String> = _firstName.asStateFlow()

    private val _lastName = MutableStateFlow("")
    val lastName: StateFlow<String> = _lastName.asStateFlow()

    private val _avatarColor = MutableStateFlow("#FF6B35")
    val avatarColor: StateFlow<String> = _avatarColor.asStateFlow()

    private val _firstNameError = MutableStateFlow(false)
    val firstNameError: StateFlow<Boolean> = _firstNameError.asStateFlow()

    private val _firstNameErrorMessage = MutableStateFlow("")
    val firstNameErrorMessage: StateFlow<String> = _firstNameErrorMessage.asStateFlow()

    private val _lastNameError = MutableStateFlow(false)
    val lastNameError: StateFlow<Boolean> = _lastNameError.asStateFlow()

    private val _lastNameErrorMessage = MutableStateFlow("")
    val lastNameErrorMessage: StateFlow<String> = _lastNameErrorMessage.asStateFlow()

    private val _state =
        MutableStateFlow(
            OnboardingUiState(
                phoneNumber = savedState[SAVED_PHONE] ?: "",
                resendAvailableAtMs = savedState[SAVED_RESEND_AT] ?: 0L,
            ),
        )
    val state: StateFlow<OnboardingUiState> = _state.asStateFlow()

    /** True on the sign-in path (existing account), false when creating an account. */
    var signingIn = false

    // Fires once backend OTP verification and local token persistence complete.
    // The enter-code screen collects this to navigate onward instead of
    // duplicating the success transition in the UI.
    private val _onboardingAuthComplete = MutableSharedFlow<Unit>()
    val onboardingAuthComplete: SharedFlow<Unit> = _onboardingAuthComplete

    /**
     * Where a returning user (this phone already finished onboarding) goes after
     * the code is accepted: the app, or Setup when this phone's inbox still has
     * to be sorted (a different account just signed in). Never the new-user
     * steps again -- consent, "You're protected" and Setup used to replay.
     */
    suspend fun returningUserRoute(): String {
        val sorted = userPreferences.userData.first().historySortedAt != 0L
        return if (sorted) ROUTE_MAIN else ROUTE_SETUP
    }

    init {
        viewModelScope.launch {
            var wasSignedIn = false
            userPreferences.userData.collect { data ->
                _userData.value = data
                val signedIn = data.authToken.isNotEmpty()
                // Activity-scoped: signing out must not leave the last account's
                // name (it skipped the next account's name step) or OTP behind.
                if (wasSignedIn && !signedIn) clearSignInState()
                wasSignedIn = signedIn
                if (data.firstName.isNotEmpty()) {
                    _firstName.value = data.firstName
                    _lastName.value = data.lastName
                    _avatarColor.value = data.avatarColor
                }
            }
        }
    }

    fun updateFirstName(name: String) {
        _firstName.value = name
        _firstNameError.value = false
        _firstNameErrorMessage.value = ""
    }

    fun updateLastName(name: String) {
        _lastName.value = name
        _lastNameError.value = false
        _lastNameErrorMessage.value = ""
    }

    fun cycleAvatarColor() {
        val colors = listOf("#FF6B35", "#5B4FE8", "#00C896", "#0A84FF", "#E91E8C")
        val currentIndex = colors.indexOf(_avatarColor.value)
        _avatarColor.value = colors[(currentIndex + 1) % colors.size]
    }

    fun getInitials(): String {
        val first =
            _firstName.value
                .trim()
                .firstOrNull()
                ?.uppercase() ?: ""
        val last =
            _lastName.value
                .trim()
                .firstOrNull()
                ?.uppercase() ?: ""
        return "$first$last".ifEmpty { "?" }
    }

    fun validateAndSaveProfile(onSuccess: () -> Unit) {
        val trimmedFirst = _firstName.value.trim()
        if (trimmedFirst.isEmpty()) {
            _firstNameError.value = true
            _firstNameErrorMessage.value = "First name is required"
            return
        }
        if (!isValidName(trimmedFirst)) {
            _firstNameError.value = true
            _firstNameErrorMessage.value = "Name should only contain letters"
            return
        }
        val trimmedLast = _lastName.value.trim()
        if (trimmedLast.isNotEmpty() && !isValidName(trimmedLast)) {
            _lastNameError.value = true
            _lastNameErrorMessage.value = "Name should only contain letters"
            return
        }
        _state.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            userPreferences.saveProfile(
                firstName = trimmedFirst,
                lastName = trimmedLast,
                avatarColor = _avatarColor.value,
            )
            // Sync the profile to the backend so the User row isn't left with null names.
            val token = userPreferences.userData.first().authToken
            if (token.isEmpty()) {
                _state.update { it.copy(isLoading = false) }
                onSuccess()
                return@launch
            }
            AuthApi
                .updateProfile(token, trimmedFirst, trimmedLast)
                .onSuccess {
                    _state.update { it.copy(isLoading = false) }
                    onSuccess()
                }.onFailure { error ->
                    _state.update {
                        it.copy(isLoading = false, errorMessage = error.toUserMessage("Could not sync your profile"))
                    }
                }
        }
    }

    fun completeOnboarding(onSuccess: () -> Unit) {
        viewModelScope.launch {
            userPreferences.setOnboardingComplete()
            onSuccess()
        }
    }

    fun updateOtpCode(code: String) {
        _state.update { it.copy(otpCode = code, errorMessage = null) }
    }

    /** Requests a Semaphore SMS OTP for a normalized Philippine mobile number. */
    fun requestVerificationCode(
        rawPhone: String,
        onCodeSent: () -> Unit,
    ) {
        val phone = normalizePhNumber(rawPhone)
        if (phone == null) {
            _state.update { it.copy(errorMessage = "Enter a valid Philippine mobile number") }
            return
        }
        _state.update { it.copy(phoneNumber = phone, isLoading = true, errorMessage = null) }
        savedState[SAVED_PHONE] = phone
        viewModelScope.launch {
            AuthApi
                .requestPhoneOtp(phone)
                .onSuccess {
                    val resendAt = System.currentTimeMillis() + RESEND_COOLDOWN_MS
                    savedState[SAVED_RESEND_AT] = resendAt
                    _state.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = null,
                            resendAvailableAtMs = resendAt,
                            // A freshly sent OTP invalidates any attempt history that applied
                            // to the previous code -- without this, fixing a typo and resending
                            // could inherit a near-lockout from the old code.
                            failedVerifyAttempts = 0,
                            verifyLockedUntilMs = 0L,
                        )
                    }
                    onCodeSent()
                }.onFailure { error ->
                    _state.update {
                        it.copy(isLoading = false, errorMessage = error.toUserMessage("Could not reach the server"))
                    }
                }
        }
    }

    fun resendVerificationCode() {
        val current = _state.value
        if (current.phoneNumber.isEmpty()) {
            // Used to return silently, leaving a Resend button that did nothing.
            _state.update { it.copy(errorMessage = SESSION_EXPIRED_MESSAGE) }
            return
        }
        val onCooldown = current.isLoading || System.currentTimeMillis() < current.resendAvailableAtMs
        if (onCooldown) return
        requestVerificationCode(current.phoneNumber) {}
    }

    private fun clearSignInState() {
        _firstName.value = ""
        _lastName.value = ""
        _state.update { it.copy(otpCode = "", errorMessage = null, isLoading = false, failedVerifyAttempts = 0) }
    }

    fun verifyCode() {
        val current = _state.value
        // A double tap must not send the same code twice.
        if (current.isLoading) return
        val validationError = codeEntryError(current)
        if (validationError != null) {
            _state.update { it.copy(errorMessage = validationError) }
            return
        }
        _state.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            AuthApi
                .verifyPhoneOtp(current.phoneNumber, current.otpCode)
                .onSuccess { auth ->
                    if (userPreferences.savePhoneAuth(auth.accessToken, current.phoneNumber)) {
                        // Another account's labels/alert marks must not carry over.
                        LocalAccountData.wipe(getApplication())
                    }
                    savedState.remove<String>(SAVED_PHONE)
                    savedState.remove<Long>(SAVED_RESEND_AT)
                    restoreProfile(auth.accessToken)
                    _state.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = null,
                            failedVerifyAttempts = 0,
                            verifyLockedUntilMs = 0L,
                        )
                    }
                    _onboardingAuthComplete.emit(Unit)
                }.onFailure { error ->
                    handleVerifyFailure(error.toUserMessage("Could not reach the server"))
                }
        }
    }

    // Sign-out clears the locally kept name; bring back the account's saved one
    // so a returning user isn't asked for it again. Best effort: without it the
    // user is simply sent to the profile step.
    private suspend fun restoreProfile(token: String) {
        val profile = AuthApi.me(token).getOrNull() ?: return
        if (profile.firstName.isBlank()) return
        userPreferences.saveProfile(profile.firstName, profile.lastName, userData.value.avatarColor)
        _firstName.value = profile.firstName
        _lastName.value = profile.lastName
    }

    private fun codeEntryError(current: OnboardingUiState): String? =
        when {
            System.currentTimeMillis() < current.verifyLockedUntilMs ->
                "Too many attempts. Please wait before trying again."
            current.otpCode.length != 6 -> "Enter the 6-digit code"
            current.phoneNumber.isEmpty() -> SESSION_EXPIRED_MESSAGE
            else -> null
        }

    private fun handleVerifyFailure(message: String) {
        _state.update {
            val attempts = it.failedVerifyAttempts + 1
            val lockedOut = attempts >= MAX_VERIFY_ATTEMPTS_BEFORE_LOCKOUT
            val lockedUntil =
                if (lockedOut) System.currentTimeMillis() + VERIFY_LOCKOUT_MS else it.verifyLockedUntilMs
            it.copy(
                isLoading = false,
                errorMessage = message,
                failedVerifyAttempts = if (lockedOut) 0 else attempts,
                verifyLockedUntilMs = lockedUntil,
            )
        }
    }

    fun updateTermsAccepted(accepted: Boolean) {
        _state.update { it.copy(termsAccepted = accepted) }
    }
}

private const val ROUTE_SETUP = "setup"
private const val ROUTE_MAIN = "main"
