function ThemeToggle({ darkMode, toggleTheme }) {
  return (
    <button className="theme-toggle-btn" onClick={toggleTheme}>
      {/* {darkMode ? '🌙 Dark' : '☀️ Light'} */}
      {darkMode ? '🌚' : '☀️'}
    </button>
  );
}

export default ThemeToggle;