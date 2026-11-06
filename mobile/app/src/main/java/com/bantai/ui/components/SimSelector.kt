package com.bantai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.SimCard
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.bantai.R
import com.bantai.ui.theme.Indigo
import com.bantai.ui.theme.Surface
import com.bantai.ui.theme.SurfaceElevated
import com.bantai.ui.theme.TextSize
import com.bantai.ui.theme.White
import com.bantai.util.Sim

/**
 * "SIM 1" / "SIM 2" switch for the next message. Shown only with two SIMs
 * active; on a single-SIM phone it takes no space.
 */
@Composable
fun SimSelector(
    sims: List<Sim>,
    selected: Int?,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (sims.size < 2) return
    var open by remember { mutableStateOf(false) }
    val current = sims.firstOrNull { it.subId == selected }
    val description = stringResource(R.string.sim_selector_description, current?.label ?: "")
    Box(modifier = modifier) {
        Row(
            modifier =
                Modifier
                    .background(Surface, RoundedCornerShape(12.dp))
                    .clickable(onClickLabel = description) { open = true }
                    .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(
                Icons.Outlined.SimCard,
                contentDescription = description,
                tint = Indigo,
                modifier = Modifier.size(16.dp),
            )
            Text(current?.shortLabel ?: "SIM", color = White, fontSize = TextSize.Caption)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = SurfaceElevated) {
            sims.forEach { sim ->
                DropdownMenuItem(
                    text = { Text(sim.label, color = if (sim.subId == selected) Indigo else White) },
                    onClick = {
                        open = false
                        onSelect(sim.subId)
                    },
                )
            }
        }
    }
}
