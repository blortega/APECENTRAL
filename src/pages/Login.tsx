import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebaseConfig";
import styles from "@/styles/Login.module.css";
import { assets } from "@/components/assets";

interface LoginFormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Successfully signed in
      console.log("User signed in:", userCredential.user);

      // Redirect to XRay page
      navigate("/xray");
    } catch (error: any) {
      console.error("Login error:", error);

      // Handle specific Firebase auth errors
      switch (error.code) {
        case "auth/user-not-found":
          setError("No account found with this email address.");
          break;
        case "auth/wrong-password":
          setError("Incorrect password. Please try again.");
          break;
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;
        case "auth/too-many-requests":
          setError("Too many failed attempts. Please try again later.");
          break;
        case "auth/network-request-failed":
          setError("Network error. Please check your connection.");
          break;
        default:
          setError("Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <div className={styles.logoGroup}>
            <img
              src={assets.innoAPE}
              alt="HealthTrack logo"
              className={styles.logo}
            />
            <div className={styles.branding}>
              <h1 className={styles.brandName}>
                <span className={styles.innoPart}>APE</span>
                <span className={styles.apePart}>Central</span>
              </h1>
              <div className={styles.byLine}>
                <span className={styles.byText}>Your</span>
                <img
                  src={assets.innodataIcon}
                  alt="Medical Records"
                  className={styles.innodataIcon}
                />
                <span className={styles.innodataText}>
                  Annual Physical Records
                </span>
              </div>
            </div>
          </div>
        </div>

        <main className={styles.mainContent}>
          <section className={styles.hero}>
            <h2 className={styles.tagline}>Welcome Back</h2>
            <p className={styles.description}>
              Access your secure health records and annual physical exam
              history.
            </p>
          </section>

          <div className={styles.loginForm}>
            <form onSubmit={handleSubmit} className={styles.form}>
              {error && <div className={styles.errorMessage}>{error}</div>}

              <div className={styles.inputGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                  placeholder="your.email@example.com"
                  autoComplete="email"
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={styles.primaryButton}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div className={styles.loginLinks}>
              <Link to="/forgot-password" className={styles.forgotLink}>
                Forgot your password?
              </Link>
            </div>
          </div>

          <div className={styles.ctaButtons}>
            <Link to="/" className={styles.secondaryButton}>
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;
