import { useState } from 'react';

export function useTheme() {
  const [darkMode, setDarkMode] = useState(true);

  // We wrap the toggle logic into its own function
  const toggleTheme = () => {
    setDarkMode(darkMode => !darkMode);
    //setDarkMode(darkMode => !darkMode);
  }

  // We return the data (darkMode) and the action (toggleTheme) 
  // so other files can use them
  return { darkMode, toggleTheme };
}