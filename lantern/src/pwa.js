/** Register the offline copy where the browser allows it (https or localhost). */
export function registerOffline() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (location.protocol !== "https:" && !local) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
