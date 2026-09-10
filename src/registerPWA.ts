// MANVI ERP V29 — PWA service-worker registration

export function registerMANVIPWA() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log(
          "MANVI ERP PWA service worker registered:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error(
          "MANVI ERP PWA service worker registration failed:",
          error
        );
      });
  });
}