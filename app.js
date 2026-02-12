// 3 usuarios hardcodeados (sin BD)
const USERS = [
  { username: "dr.garcia",  password: "1234", name: "Dr. García" },
  { username: "dr.lopez",   password: "1234", name: "Dr. López" },
  { username: "dra.santos", password: "1234", name: "Dra. Santos" },
];

const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const u = document.getElementById("user").value.trim();
  const p = document.getElementById("pass").value;

  const found = USERS.find(x => x.username === u && x.password === p);

  if (!found) {
    msg.textContent = "Usuario o contraseña incorrectos.";
    msg.className = "msg error";
    return;
  }

  // Guardar sesión simple en localStorage
  localStorage.setItem("doctor_session", JSON.stringify({
    username: found.username,
    name: found.name,
    ts: Date.now()
  }));

  msg.textContent = `Bienvenido/a, ${found.name}. Redirigiendo...`;
  msg.className = "msg ok";

  // aquí luego mandamos a doctor.html
  setTimeout(() => {
    window.location.href = "doctor.html";
  }, 600);
});
