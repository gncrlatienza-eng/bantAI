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
