import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebaseConfig";
import styles from "@/styles/Forgot-Password.module.css";
import { assets } from "@/components/assets";

interface ForgotPasswordFormData {
  email: string;
}

const ForgotPassword: React.FC = () => {
  const [formData, setFormData] = useState<ForgotPasswordFormData>({
    email: "",
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [emailSent, setEmailSent] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear any existing messages when user starts typing
    setError("");
    setMessage("");
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setMessage(
        `Password reset email sent to ${formData.email}. Please check your inbox and spam folder.`
      );
      setEmailSent(true);
    } catch (error: any) {
      console.error("Password reset error:", error);

      // Handle specific Firebase Auth errors
      switch (error.code) {
        case "auth/user-not-found":
          setError("No account found with this email address.");
          break;
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;
        case "auth/too-many-requests":
          setError("Too many reset attempts. Please try again later.");
          break;
        default:
          setError("Failed to send reset email. Please try again.");
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
            <h2 className={styles.tagline}>Reset Your Password</h2>
            <p className={styles.description}>
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </section>

          <div className={styles.resetForm}>
            {!emailSent ? (
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

                {error && <div className={styles.errorMessage}>{error}</div>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={styles.primaryButton}
                >
                  {isLoading ? "Sending..." : "Send Reset Email"}
                </button>
              </form>
            ) : (
              <div className={styles.successContainer}>
                <div className={styles.successIcon}>✉️</div>
                <div className={styles.successMessage}>{message}</div>
                <button
                  onClick={() => {
                    setEmailSent(false);
                    setMessage("");
                    setFormData({ email: "" });
                  }}
                  className={styles.resendButton}
                >
                  Send Another Email
                </button>
              </div>
            )}

            <div className={styles.resetLinks}>
              <Link to="/login" className={styles.backLink}>
                Back to Sign In
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

export default ForgotPassword;
