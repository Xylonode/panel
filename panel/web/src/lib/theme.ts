import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "xylonode-theme";

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Light by default; persists the choice and toggles the [data-theme] attribute. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(KEY) as Theme) ?? "light",
  );

  useEffect(() => {
    apply(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}
