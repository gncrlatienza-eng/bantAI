package com.bantai.viewmodel

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.UserData
import com.bantai.data.local.UserPreferences
import com.bantai.data.remote.AuthApi
import com.bantai.util.isValidName
import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthMissingActivityForRecaptchaException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

private const val PH_MOBILE_DIGIT_COUNT = 10
private const val PH_MOBILE_LEADING_DIGIT = '9'

// Client-side abuse-prevention only, defense-in-depth on top of whatever
// Firebase enforces server-side -- this just stops the UI from firing
// verification request/verify calls as fast as a user (or a script driving
// the same flow) can tap.
private const val RESEND_COOLDOWN_MS = 30_000L
private const val MAX_VERIFY_ATTEMPTS_BEFORE_LOCKOUT = 5
private const val VERIFY_LOCKOUT_MS = 30_000L
private const val FIREBASE_CODE_TIMEOUT_SECONDS = 60L

data class OnboardingUiState(
    val phoneNumber: String = "",
    val termsAccepted: Boolean = false,
    val otpCode: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val resendAvailableAtMs: Long = 0L,
    val failedVerifyAttempts: Int = 0,
    val verifyLockedUntilMs: Long = 0L,
    // Firebase's handle for "which SMS challenge is this code for" -- returned by
    // onCodeSent, required to build a PhoneAuthCredential from the typed digits.
    val firebaseVerificationId: String? = null,
)

class OnboardingViewModel(
    application: Application,
) : AndroidViewModel(application) {
    private val userPreferences = UserPreferences(application)

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

    private val _state = MutableStateFlow(OnboardingUiState())
    val state: StateFlow<OnboardingUiState> = _state.asStateFlow()

    // SDK plumbing, not UI state -- lives as a plain field rather than in
    // OnboardingUiState so it never affects Compose recomposition/equality.
    private var forceResendingToken: PhoneAuthProvider.ForceResendingToken? = null

    // Fires once phone auth is fully complete (Firebase sign-in + backend token
    // exchange + saveAuth), regardless of whether that happened because the user
    // typed the code and tapped Verify, or Firebase auto-retrieved it via Play
    // Services. The enter-code screen collects this to navigate onward, instead
    // of duplicating "what does success mean" across two trigger paths.
    private val _onboardingAuthComplete = MutableSharedFlow<Unit>()
    val onboardingAuthComplete: SharedFlow<Unit> = _onboardingAuthComplete

    init {
        viewModelScope.launch {
            userPreferences.userData.collect { data ->
                _userData.value = data
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
                        it.copy(isLoading = false, errorMessage = error.message ?: "Could not sync your profile")
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

    /**
     * Normalizes manual entry ("9171234567", "09171234567") and SIM-detected
     * numbers (already "+63 917 123 4567") to the same "+63..." form the
     * backend and every other stored phone number use. Without this, a
     * manually typed number was saved with no country code at all, so it
     * would never match its own SIM-detected form or any other +63 row.
     *
     * Returns null for anything that isn't a plausible PH mobile number
     * (wrong length, a landline, a non-PH number) instead of silently
     * forcing it into a syntactically-plausible-but-wrong "+63..." value.
     */
    private fun normalizePhone(raw: String): String? {
        val trimmed = raw.trim().replace(Regex("[\\s\\-()]"), "")
        // Any "+" prefix that isn't "+63" is a non-PH E.164 number; reject rather
        // than mangle it into a syntactically-plausible-but-wrong +63 value.
        if (trimmed.startsWith("+") && !trimmed.startsWith("+63")) return null
        val digits =
            when {
                trimmed.startsWith("+63") -> trimmed.removePrefix("+63")
                trimmed.startsWith("0063") -> trimmed.removePrefix("0063")
                trimmed.startsWith("63") && trimmed.length > PH_MOBILE_DIGIT_COUNT -> trimmed.removePrefix("63")
                trimmed.startsWith("0") -> trimmed.removePrefix("0")
                else -> trimmed
            }.filter { it.isDigit() }
        return digits
            .takeIf { it.length == PH_MOBILE_DIGIT_COUNT && it.first() == PH_MOBILE_LEADING_DIGIT }
            ?.let { "+63$it" }
    }

    /**
     * Kicks off Firebase Phone Authentication for [rawPhone]. Firebase sends and
     * verifies the SMS code itself -- the backend is not involved until the
     * resulting ID token is exchanged in [verifyCode]/[signInWithCredential].
     *
     * [activity] is used synchronously to build [PhoneAuthOptions] (Firebase needs
     * it to host the reCAPTCHA/SafetyNet fallback UI if silent Play Integrity
     * verification isn't available) and is never stored on this ViewModel or
     * captured by the callbacks below -- it goes out of scope as soon as this
     * function returns, so it can't leak past this call.
     */
    fun requestVerificationCode(
        activity: Activity,
        rawPhone: String,
        onCodeSent: () -> Unit,
    ) {
        val phone = normalizePhone(rawPhone)
        if (phone == null) {
            _state.update { it.copy(errorMessage = "Enter a valid PH mobile number") }
            return
        }
        _state.update { it.copy(phoneNumber = phone, isLoading = true, errorMessage = null) }
        val options =
            PhoneAuthOptions
                .newBuilder(FirebaseAuth.getInstance())
                .setPhoneNumber(phone)
                .setTimeout(FIREBASE_CODE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .setActivity(activity)
                .setCallbacks(verificationCallbacks(onCodeSent))
                .build()
        PhoneAuthProvider.verifyPhoneNumber(options)
    }

    fun resendVerificationCode(activity: Activity) {
        val current = _state.value
        val onCooldown = current.isLoading || System.currentTimeMillis() < current.resendAvailableAtMs
        if (current.phoneNumber.isEmpty() || onCooldown) return
        val token = forceResendingToken
        if (token == null) {
            requestVerificationCode(activity, current.phoneNumber) {}
            return
        }
        _state.update { it.copy(isLoading = true, errorMessage = null) }
        val options =
            PhoneAuthOptions
                .newBuilder(FirebaseAuth.getInstance())
                .setPhoneNumber(current.phoneNumber)
                .setTimeout(FIREBASE_CODE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .setActivity(activity)
                .setCallbacks(verificationCallbacks(onCodeSent = {}))
                .setForceResendingToken(token)
                .build()
        PhoneAuthProvider.verifyPhoneNumber(options)
    }

    private fun verificationCallbacks(
        onCodeSent: () -> Unit,
    ): PhoneAuthProvider.OnVerificationStateChangedCallbacks =
        object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
            // Some devices/numbers let Play Services auto-retrieve the SMS code
            // without the user ever typing it -- route through the same
            // sign-in path as manual verification so both end up in the same place.
            override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                viewModelScope.launch { signInWithCredential(credential) }
            }

            override fun onVerificationFailed(e: FirebaseException) {
                _state.update { it.copy(isLoading = false, errorMessage = mapFirebaseError(e)) }
            }

            override fun onCodeSent(
                verificationId: String,
                token: PhoneAuthProvider.ForceResendingToken,
            ) {
                forceResendingToken = token
                _state.update {
                    it.copy(
                        isLoading = false,
                        firebaseVerificationId = verificationId,
                        resendAvailableAtMs = System.currentTimeMillis() + RESEND_COOLDOWN_MS,
                    )
                }
                onCodeSent()
            }
        }

    fun verifyCode() {
        val current = _state.value
        val validationError = codeEntryError(current)
        if (validationError != null) {
            _state.update { it.copy(errorMessage = validationError) }
            return
        }
        val verificationId = current.firebaseVerificationId ?: return
        _state.update { it.copy(isLoading = true, errorMessage = null) }
        val credential = PhoneAuthProvider.getCredential(verificationId, current.otpCode)
        viewModelScope.launch { signInWithCredential(credential) }
    }

    private fun codeEntryError(current: OnboardingUiState): String? =
        when {
            System.currentTimeMillis() < current.verifyLockedUntilMs ->
                "Too many attempts. Please wait before trying again."
            current.otpCode.length != 6 -> "Enter the 6-digit code"
            current.firebaseVerificationId == null -> "Verification session expired. Please resend the code."
            else -> null
        }

    /**
     * Shared completion path for both manual code entry ([verifyCode]) and
     * Firebase's auto-instant-verification ([onVerificationCompleted]) -- signs
     * into Firebase, exchanges the resulting ID token for a bantAI JWT, and
     * stores it exactly as the old OTP-based verifyOtp did. Emits
     * [onboardingAuthComplete] on success so either trigger navigates the same way.
     */
    private suspend fun signInWithCredential(credential: PhoneAuthCredential) {
        val phone = _state.value.phoneNumber
        try {
            val authResult = FirebaseAuth.getInstance().signInWithCredential(credential).await()
            val user = authResult.user ?: error("No FirebaseUser after sign-in")
            val idToken = user.getIdToken(false).await().token ?: error("No Firebase ID token returned")

            AuthApi
                .exchangeFirebaseToken(idToken)
                .onSuccess { auth ->
                    userPreferences.saveAuth(auth.accessToken, phone)
                    _state.update { it.copy(isLoading = false, failedVerifyAttempts = 0, verifyLockedUntilMs = 0L) }
                    _onboardingAuthComplete.emit(Unit)
                }.onFailure { error ->
                    handleVerifyFailure(error.message ?: "Could not reach the server")
                }
        } catch (e: FirebaseException) {
            handleVerifyFailure(mapFirebaseError(e))
        }
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

    private fun mapFirebaseError(e: Exception): String =
        when (e) {
            is FirebaseAuthInvalidCredentialsException -> "Invalid verification code."
            is FirebaseTooManyRequestsException -> "Too many attempts. Please try again later."
            is FirebaseAuthMissingActivityForRecaptchaException ->
                "Verification could not be started. Please try again."
            else -> e.localizedMessage ?: "Verification failed. Please try again."
        }

    fun updateTermsAccepted(accepted: Boolean) {
        _state.update { it.copy(termsAccepted = accepted) }
    }
}
