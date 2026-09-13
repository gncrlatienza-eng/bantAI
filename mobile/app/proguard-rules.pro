# ViewModels — instantiated via reflection by ViewModelProvider
-keep class * extends androidx.lifecycle.ViewModel { <init>(...); }
-keep class * extends androidx.lifecycle.AndroidViewModel { <init>(...); }

# Model / data classes passed across compilation boundaries
-keep class com.bantai.data.model.SmsMessage { *; }
-keep class com.bantai.data.local.UserData { *; }
-keep class com.bantai.util.BlockHelper$BlockedEntry { *; }

# Navigation route sealed class (route strings resolved at runtime)
-keep class com.bantai.navigation.Screen { *; }
-keep class com.bantai.navigation.Screen$* { *; }

# BroadcastReceivers and Services declared in AndroidManifest
-keep class com.bantai.receiver.** { *; }

# Standard Android rules
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-keepclassmembers class * implements android.os.Parcelable {
    static ** CREATOR;
}
# Kotlin metadata needed by reflection
-keep class kotlin.Metadata { *; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# androidx.security:security-crypto (SecureTokenStore) is backed by Google Tink,
# which registers its AEAD/key-manager implementations via reflection over
# generated protobuf classes. Without these, EncryptedSharedPreferences.create()
# throws at runtime in a minified build only — release-only, never seen in the
# debug builds this project has actually been tested on — the exact kind of
# failure that would surface as "login/OTP is broken" for every UAT participant
# on first launch, not something we've been able to catch without a signed,
# minified build to actually install and exercise.
-keep class com.google.crypto.tink.** { *; }
-keep class com.google.crypto.tink.proto.** { *; }
-keepclassmembers class * extends com.google.crypto.tink.shaded.protobuf.GeneratedMessageLite {
    <fields>;
}
-dontwarn com.google.crypto.tink.**
-dontwarn com.google.errorprone.annotations.**
