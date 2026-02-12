const raw = localStorage.getItem("doctor_session");
if (!raw) window.location.href = "index.html";

const session = JSON.parse(raw);
document.getElementById("who").textContent = `Sesión activa: ${session.name} (${session.username})`;

document.getElementById("logout").addEventListener("click", () => {
  localStorage.removeItem("doctor_session");
  window.location.href = "index.html";
});
