// Simple localStorage-based auth
const STORAGE_KEY = "app_auth";

function login(username, password) {
  const payload = {
    username,
    password,
    loggedInAt: Date.now(),
    url: "https://wfo-bruneck.digitalesregister.it/v2",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

function isLoggedIn() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    return Boolean(obj?.username) && Boolean(obj?.password);
  } catch {
    return false;
  }
}

function getUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.username ? obj : null;
  } catch {
    return null;
  }
}

export { login, logout, isLoggedIn, getUser };
