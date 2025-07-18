window.addEventListener("DOMContentLoaded", () => {
  // Use of locale messages to set the text content of elements
  document.getElementById("continue").textContent =
    browser.i18n.getMessage("warning_continue");
  document.getElementById("cancel").textContent =
    browser.i18n.getMessage("warning_cancel");
  document.getElementById("warning_title").textContent =
    browser.i18n.getMessage("warning_title");
  document.getElementById("warning_text").textContent =
    browser.i18n.getMessage("warning_text");

  // Add event listeners to the elements
  document.getElementById("continue").addEventListener("click", () => {
    window.close();
    browser.runtime.sendMessage({ action: "continue" });
  });

  document.getElementById("cancel").addEventListener("click", () => {
    window.close();
    browser.runtime.sendMessage({ action: "cancel" });
  });
});
