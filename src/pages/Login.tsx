function Login() {
  return (
    <div style={{ padding: 20 }}>
      <h1>MANVI ERP</h1>
      <h2>Login</h2>

      <input
        type="email"
        placeholder="Email"
        style={{ display: "block", marginBottom: 10, width: "100%", padding: 10 }}
      />

      <input
        type="password"
        placeholder="Password"
        style={{ display: "block", marginBottom: 10, width: "100%", padding: 10 }}
      />

      <button style={{ padding: 10, width: "100%" }}>
        Login
      </button>
    </div>
  );
}

export default Login;
