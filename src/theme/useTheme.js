import { useState, useEffect } from 'react';

export function useTheme() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('power_project_theme');
    return saved !== 'light'; // Defaults to true (dark) if nothing saved
  });

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('power_project_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.className = theme;
    const metaThemeColor = document.getElementById('meta-theme-color') || document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', darkMode ? '#050505' : '#fcfcfd');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  return { darkMode, toggleTheme };
}