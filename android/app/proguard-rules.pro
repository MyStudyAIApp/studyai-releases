# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Capacitor: mantener el puente WebView<->Java y los plugins intactos.
# Sin esto, R8 puede renombrar/eliminar métodos que Capacitor invoca por
# reflexión desde el JS empaquetado, rompiendo la app en tiempo de ejecución
# sin ningún error de compilación que lo avise.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public *;
}
-keepclassmembers class fqcn.of.javascript.interface.for.webview {
   public *;
}

# MyStudy Scan usa ML Kit Document Scanner y reconocimiento de voz -- estas
# librerías de Google Play Services necesitan sus clases intactas para el
# (des)serializado interno por reflexión.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.**
