import { Link } from "react-router-dom";
import styles from "@/styles/Home.module.css";
import { assets } from "@/components/assets";

export default function Home() {
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
            <h2 className={styles.tagline}>
              Your Health Records, Organized and Secure
            </h2>
            <p className={styles.description}>
              Easily access, upload, and manage your annual physical exam
              records in one secure place. Take control of your health history.
            </p>
          </section>

          <div className={styles.ctaButtons}>
            <Link to="/register" className={styles.primaryButton}>
              Create Account
            </Link>
            <Link to="/login" className={styles.secondaryButton}>
              Patient Login
            </Link>
            <Link to="/xray" className={styles.secondaryButton}>
              X-Ray Viewer
            </Link>
          </div>

          <section className={styles.features}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📋</div>
              <h3>Comprehensive Records</h3>
              <p>
                Store all your exam results and medical history in one place
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔐</div>
              <h3>HIPAA Compliant</h3>
              <p>Your health data is protected with bank-level security</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📱</div>
              <h3>Access Anywhere</h3>
              <p>View your records anytime on any device</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
