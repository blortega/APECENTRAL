import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/firebaseConfig";
import styles from "@/styles/Login.module.css";
import { assets } from "@/components/assets";

interface LoginFormData {
  emailOrUsername: string;
  password: string;
}

const Login: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    emailOrUsername: "",
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

  // Helper function to check if input is an email
  const isEmail = (input: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  };

  // Function to get authentication email from username
  const getAuthEmailFromUsername = async (
    username: string
  ): Promise<string | null> => {
    try {
      // Clean username (make lowercase and remove spaces, matching registration logic)
      const cleanUsername = username.toLowerCase().replace(/\s+/g, "");

      // Query Firestore to find user with matching username
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", cleanUsername));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        // Return the authEmail (used for Firebase Auth) or email if authEmail doesn't exist
        return userData.authEmail || userData.email || null;
      }

      return null;
    } catch (error) {
      console.error("Error fetching user by username:", error);
      return null;
    }
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      let emailToUse = formData.emailOrUsername.trim();

      // If input is not an email, try to get the authentication email from username
      if (!isEmail(emailToUse)) {
        const authEmail = await getAuthEmailFromUsername(emailToUse);
        if (!authEmail) {
          setError(
            "Username not found. Please check your username or try using your email address."
          );
          setIsLoading(false);
          return;
        }
        emailToUse = authEmail;
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        emailToUse,
        formData.password
      );

      // Successfully signed in
      console.log("User signed in:", userCredential.user);

      // Redirect to XRay page
      navigate("/xrayadmin");
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
          setError("Please enter a valid email address or username.");
          break;
        case "auth/invalid-credential":
          setError("Invalid email/username or password. Please try again.");
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
                <label htmlFor="emailOrUsername" className={styles.label}>
                  Email Address or Username
                </label>
                <input
                  type="text"
                  id="emailOrUsername"
                  name="emailOrUsername"
                  value={formData.emailOrUsername}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                  placeholder="your.email@example.com or username"
                  autoComplete="username"
                />
                <small className={styles.inputHint}>
                  You can sign in with either your email address or username.
                </small>
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
