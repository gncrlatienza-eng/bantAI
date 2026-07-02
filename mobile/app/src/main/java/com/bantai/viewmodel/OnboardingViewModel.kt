package com.bantai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.bantai.data.local.UserData
import com.bantai.data.local.UserPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class OnboardingUiState(
    val phoneNumber: String = "",
    val termsAccepted: Boolean = false,
    val otpCode: String = ""
)

class OnboardingViewModel(application: Application) : AndroidViewModel(application) {

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

    fun isValidName(name: String): Boolean =
        name.trim().all { it.isLetter() || it.isWhitespace() }

    fun cycleAvatarColor() {
        val colors = listOf("#FF6B35", "#5B4FE8", "#00C896", "#0A84FF", "#E91E8C")
        val currentIndex = colors.indexOf(_avatarColor.value)
        _avatarColor.value = colors[(currentIndex + 1) % colors.size]
    }

    fun getInitials(): String {
        val first = _firstName.value.trim().firstOrNull()?.uppercase() ?: ""
        val last = _lastName.value.trim().firstOrNull()?.uppercase() ?: ""
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
        viewModelScope.launch {
            userPreferences.saveProfile(
                firstName = trimmedFirst,
                lastName = trimmedLast,
                avatarColor = _avatarColor.value
            )
            onSuccess()
        }
    }

    fun completeOnboarding(onSuccess: () -> Unit) {
        viewModelScope.launch {
            userPreferences.setOnboardingComplete()
            onSuccess()
        }
    }

    fun updateOtpCode(code: String) {
        _state.update { it.copy(otpCode = code) }
    }

    fun updateTermsAccepted(accepted: Boolean) {
        _state.update { it.copy(termsAccepted = accepted) }
    }
}
