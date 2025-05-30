import React, { useState } from "react";
import { Link } from "react-router-dom";
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: Implement actual login logic here
    console.log("Login attempt:", formData);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
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
