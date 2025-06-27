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
              Keep Track of Your Health Records
            </h2>
            <p className={styles.description}>
              A simple way to organize and store your annual physical exam
              records. Start building your personal health history.
            </p>
          </section>

          <div className={styles.ctaButtons}>
            <Link to="/register" className={styles.primaryButton}>
              Create Account
            </Link>
            <Link to="/login" className={styles.secondaryButton}>
              Login
            </Link>
          </div>

          <section className={styles.features}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📋</div>
              <h3>Organize Records</h3>
              <p>
                Keep your annual physical exam results in one convenient location
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>👁️</div>
              <h3>A Live Preview of Every Records</h3>
              <p>View and review all your health records at a glance</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⬇️</div>
              <h3>Download Anytime</h3>
              <p>Get copies of your records whenever you need them</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}