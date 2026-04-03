import { t } from "./i18n/index.js";

function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }
  callback();
}

function initLoginShell() {
  const form = document.getElementById("login_form");
  const submit = document.getElementById("login_submit");
  const errorBox = document.getElementById("login_error");

  if (!form || !submit || !errorBox) {
    return;
  }

  function setError(message) {
    if (!message) {
      errorBox.textContent = "";
      errorBox.classList.remove("visible");
      return;
    }
    errorBox.textContent = message;
    errorBox.classList.add("visible");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    submit.disabled = true;

    const username = document.getElementById("login_username").value.trim();
    const password = document.getElementById("login_password").value;

    try {
      const resp = await fetch("/api/session/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.ok === false) {
        setError(data.error || `HTTP ${resp.status}`);
        submit.disabled = false;
        return;
      }
      window.location.replace("/");
    } catch {
      setError(t("login.request_failed"));
      submit.disabled = false;
    }
  });
}

onReady(initLoginShell);
