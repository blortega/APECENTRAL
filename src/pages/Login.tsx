import { useState } from "react";
import { assets } from "@/components/assets";
import styles from "@/styles/Login.module.css";

interface FormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginPage() {
  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Authentication logic would go here
      console.log("Login attempt with:", formData.username);
      // Implement authentication with Firebase or your preferred auth provider
      alert("Login successful!");
    } catch (error) {
      console.error("Login failed: ", error);
      alert("Login failed. Please check your credentials.");
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = () => {
    // Handle forgot password navigation
    // In a SPA, you might use React Router: navigate('/forgot-password')
    console.log("Navigate to forgot password");
  };

  const handleRegister = () => {
    // Handle registration navigation
    // In a SPA, you might use React Router: navigate('/register')
    console.log("Navigate to register");
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.loginContainer}>
        <div className={styles.logoSection}>
          <img
            src={assets.innoAPE}
            alt="Company Logo"
            width={100}
            height={100}
            className={styles.logo}
          />
          <h1 className={styles.companyName}>InnoAPE</h1>
        </div>

        <div className={styles.formWrapper}>
          <h2 className={styles.formTitle}>Employee Login</h2>

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.inputGroup}>
              <label htmlFor="username" className={styles.label}>
                Username / Employee ID
              </label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username or ID"
                value={formData.username}
                onChange={handleChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <div className={styles.passwordInputWrapper}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className={styles.input}
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className={styles.passwordToggle}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className={styles.options}>
              <div className={styles.rememberMe}>
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className={styles.checkbox}
                />
                <label htmlFor="rememberMe">Remember me</label>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                className={styles.forgotPassword}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className={styles.submitButton}>
              Login
            </button>
          </form>

          <div className={styles.registerPrompt}>
            <p>Don't have an account?</p>
            <button
              type="button"
              onClick={handleRegister}
              className={styles.registerLink}
            >
              Register here
            </button>
          </div>
        </div>
      </div>

      <div className={styles.imageContainer}>
        <img
          src={assets.innoAPEbg}
          alt="Login background"
          className={styles.bgImage}
        />
        <div className={styles.overlay}></div>
        <div className={styles.welcomeText}>
          <h2>Welcome Back!</h2>
          <p>Log in to access your employee dashboard and resources.</p>
        </div>
      </div>
    </div>
  );
}
