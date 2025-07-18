// Update the select menu according to the stored value
async function updateSelectFromStorage() {
  const { sortOption } = await browser.storage.local.get("sortOption");
  if (sortOption) {
    document.getElementById("sortOption").value = sortOption;
  }
}

// On page load, update the selection
document.addEventListener("DOMContentLoaded", async () => {
  // Localized text
  document.getElementById("sortingOptions").textContent =
    browser.i18n.getMessage("sortingOptions");
  document.getElementById("sortEmailsBy").textContent =
    browser.i18n.getMessage("sortEmailsBy");
  document.getElementById("alphabetical").textContent =
    browser.i18n.getMessage("alphabeticalOrder");
  document.getElementById("categories").textContent =
    browser.i18n.getMessage("categoriesOrder");

  await updateSelectFromStorage();
});

// When the user changes the selection, save it
document.getElementById("sortOption").addEventListener("change", async (e) => {
  await browser.storage.local.set({
    sortOption: e.target.value,
  });
});

// Update dynamically if the value changes elsewhere,
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.sortOption) {
    document.getElementById("sortOption").value = changes.sortOption.newValue;
  }
});
