package org.unfpa.otg.ui.onboarding

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val APAC_COUNTRIES = listOf(
    "MMR" to "Myanmar",
    "BGD" to "Bangladesh",
    "NPL" to "Nepal",
    "IDN" to "Indonesia",
    "PHL" to "Philippines",
    "KHM" to "Cambodia",
    "LAO" to "Laos",
    "VNM" to "Vietnam",
    "PAK" to "Pakistan",
    "AFG" to "Afghanistan",
    "IND" to "India",
    "PNG" to "Papua New Guinea",
    "TLS" to "Timor-Leste",
)

@Composable
fun CountrySelectScreen(
    initialCountry: String,
    onCountrySelected: (String) -> Unit,
    onContinue: () -> Unit,
) {
    var selected by remember { mutableStateOf(initialCountry) }
    var searchQuery by remember { mutableStateOf("") }

    val filtered = APAC_COUNTRIES.filter {
        it.second.contains(searchQuery, ignoreCase = true) ||
        it.first.contains(searchQuery, ignoreCase = true)
    }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text("Select Country", style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold)
        Text("This helps the app retrieve country-specific guidelines and MOH protocols.",
            style = MaterialTheme.typography.bodyMedium)

        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search countries…") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        Spacer(Modifier.height(8.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            item {
                ListItem(
                    headlineContent = { Text("No specific country") },
                    supportingContent = { Text("Use generic regional guidelines") },
                    leadingContent = {
                        RadioButton(selected = selected.isBlank(), onClick = { selected = "" })
                    },
                    modifier = Modifier.clickable { selected = "" },
                )
            }
            items(filtered, key = { it.first }) { (iso, name) ->
                ListItem(
                    headlineContent = { Text(name) },
                    supportingContent = { Text(iso) },
                    leadingContent = {
                        RadioButton(selected = selected == iso, onClick = { selected = iso })
                    },
                    modifier = Modifier.clickable { selected = iso },
                )
            }
        }

        Button(
            onClick = { onCountrySelected(selected); onContinue() },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Continue")
        }
    }
}
