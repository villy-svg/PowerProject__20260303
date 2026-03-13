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
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  return { darkMode, toggleTheme };
}