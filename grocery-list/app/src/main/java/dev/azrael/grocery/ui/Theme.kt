package dev.azrael.grocery.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// "Farmers market": herb green, sage and tomato on warm paper. The app's own palette is used
// instead of the wallpaper colors so it looks the same on every phone.
private val Herb = Color(0xFF2F6B4F)
private val HerbLight = Color(0xFF8FD3AE)
private val Tomato = Color(0xFFC4492F)
private val TomatoLight = Color(0xFFFFB4A1)
private val Paper = Color(0xFFFBF8F1)
private val Night = Color(0xFF101714)

private val LightColors = lightColorScheme(
    primary = Herb,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCDEBD9),
    onPrimaryContainer = Color(0xFF0B2C1C),
    secondary = Color(0xFF5B6B53),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE2EBD3),
    onSecondaryContainer = Color(0xFF1A2614),
    tertiary = Tomato,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFDBD1),
    onTertiaryContainer = Color(0xFF3D0B02),
    background = Paper,
    onBackground = Color(0xFF1C1C17),
    surface = Paper,
    onSurface = Color(0xFF1C1C17),
    surfaceVariant = Color(0xFFE6E3D6),
    onSurfaceVariant = Color(0xFF4A4A40),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFF5F2E9),
    surfaceContainer = Color(0xFFEFECE2),
    surfaceContainerHigh = Color(0xFFE9E6DC),
    surfaceContainerHighest = Color(0xFFE3E0D5),
    outline = Color(0xFF7B7A6E),
    outlineVariant = Color(0xFFCBC8BA),
)

private val DarkColors = darkColorScheme(
    primary = HerbLight,
    onPrimary = Color(0xFF00391F),
    primaryContainer = Color(0xFF1C5138),
    onPrimaryContainer = Color(0xFFCDEBD9),
    secondary = Color(0xFFC1CFB3),
    onSecondary = Color(0xFF2C3725),
    secondaryContainer = Color(0xFF424E3B),
    onSecondaryContainer = Color(0xFFE2EBD3),
    tertiary = TomatoLight,
    onTertiary = Color(0xFF5F1504),
    tertiaryContainer = Color(0xFF8A2A16),
    onTertiaryContainer = Color(0xFFFFDBD1),
    background = Night,
    onBackground = Color(0xFFE3E3DB),
    surface = Night,
    onSurface = Color(0xFFE3E3DB),
    surfaceVariant = Color(0xFF3F4942),
    onSurfaceVariant = Color(0xFFBFC9C0),
    surfaceContainerLowest = Color(0xFF0B110E),
    surfaceContainerLow = Color(0xFF18201C),
    surfaceContainer = Color(0xFF1C2420),
    surfaceContainerHigh = Color(0xFF262F2A),
    surfaceContainerHighest = Color(0xFF313A35),
    outline = Color(0xFF89938B),
    outlineVariant = Color(0xFF3F4942),
)

private val Base = Typography()

private val AppTypography = Typography(
    displaySmall = Base.displaySmall.copy(fontWeight = FontWeight.Bold),
    headlineLarge = Base.headlineLarge.copy(fontWeight = FontWeight.Bold),
    headlineMedium = Base.headlineMedium.copy(fontWeight = FontWeight.Bold),
    headlineSmall = Base.headlineSmall.copy(fontWeight = FontWeight.SemiBold),
    titleLarge = Base.titleLarge.copy(fontWeight = FontWeight.Bold, fontSize = 24.sp, letterSpacing = (-0.2).sp),
    titleMedium = Base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
    titleSmall = Base.titleSmall.copy(fontWeight = FontWeight.SemiBold),
    labelLarge = Base.labelLarge.copy(fontWeight = FontWeight.SemiBold),
    labelMedium = Base.labelMedium.copy(fontWeight = FontWeight.Medium),
)

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun GroceryTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        typography = AppTypography,
        shapes = AppShapes,
        content = content,
    )
}
