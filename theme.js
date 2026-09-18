const THEME_KEY = "overhead-theme";
const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");

function setTheme(isDark) {
  root.dataset.theme = isDark ? "dark" : "light";
  if (!toggle) return;

  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode",
  );
  toggle.querySelector(".theme-toggle-icon").textContent = isDark ? "☀" : "☾";
  toggle.querySelector(".theme-toggle-label").textContent = isDark
    ? "Light mode"
    : "Dark mode";
}

const savedTheme = localStorage.getItem(THEME_KEY);
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
setTheme(savedTheme ? savedTheme === "dark" : prefersDark);

toggle?.addEventListener("click", () => {
  const isDark = root.dataset.theme !== "dark";
  setTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});
