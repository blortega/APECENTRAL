import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebaseConfig";
import styles from "@/styles/Register.module.css";
import { assets } from "@/components/assets";

interface RegisterFormData {
  firstName: string;
  middleInitial: string;
  lastName: string;
  email: string;
  employeeId: string;
  gender: string;
  birthdate: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formStep, setFormStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);

  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: "",
    middleInitial: "",
    lastName: "",
    email: "",
    employeeId: "",
    gender: "",
    birthdate: "",
    password: "",
    confirmPassword: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    let processedValue = value;

    // Auto-uppercase specific fields
    if (
      name === "firstName" ||
      name === "lastName" ||
      name === "middleInitial" ||
      name === "employeeId"
    ) {
      processedValue = value.toUpperCase();
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.firstName.trim()) {
          alert("Please enter your first name");
          return false;
        }
        if (!formData.lastName.trim()) {
          alert("Please enter your last name");
          return false;
        }
        if (!formData.email.trim()) {
          alert("Please enter your email address");
          return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          alert("Please enter a valid email address");
          return false;
        }
        return true;

      case 2:
        if (!formData.employeeId.trim()) {
          alert("Please enter your Employee ID");
          return false;
        }
        if (!formData.gender) {
          alert("Please select your gender");
          return false;
        }
        if (!formData.birthdate) {
          alert("Please enter your birthdate");
          return false;
        }
        return true;

      case 3:
        if (formData.password.length < 6) {
          alert("Password must be at least 6 characters long");
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          alert("Passwords do not match");
          return false;
        }
        return true;

      default:
        return false;
    }
  };

  const nextStep = (): void => {
    if (validateStep(formStep)) {
      setFormStep((prev) => prev + 1);
    }
  };

  const prevStep = (): void => {
    setFormStep((prev) => prev - 1);
  };

  const checkEmployeeIdExists = async (
    employeeId: string
  ): Promise<boolean> => {
    try {
      const docRef = doc(db, "users", employeeId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error("Error checking employee ID:", error);
      return false;
    }
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!validateStep(3)) return;

    setIsLoading(true);

    try {
      // Check if employee ID already exists
      const employeeExists = await checkEmployeeIdExists(formData.employeeId);
      if (employeeExists) {
        alert(
          "Employee ID already exists. Please contact HR if this is an error."
        );
        setIsLoading(false);
        return;
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Store user data in Firestore
      await setDoc(doc(db, "users", formData.employeeId), {
        uid: userCredential.user.uid,
        firstName: formData.firstName,
        middleInitial: formData.middleInitial,
        lastName: formData.lastName,
        email: formData.email,
        employeeId: formData.employeeId,
        gender: formData.gender,
        birthdate: formData.birthdate,
        createdAt: serverTimestamp(),
        role: "Employee", // Default role
      });

      alert("Registration successful! Please sign in with your new account.");
      navigate("/login");
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.code === "auth/email-already-in-use") {
        alert(
          "This email is already registered. Please use a different email or sign in."
        );
      } else if (error.code === "auth/weak-password") {
        alert("Password is too weak. Please choose a stronger password.");
      } else {
        alert("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <div key={step} className={styles.stepIndicatorItem}>
          <div
            className={`${styles.stepNumber} ${
              formStep >= step ? styles.stepActive : ""
            } ${formStep > step ? styles.stepCompleted : ""}`}
          >
            {step}
          </div>
          <span
            className={`${styles.stepLabel} ${
              formStep >= step ? styles.stepLabelActive : ""
            }`}
          >
            {step === 1 && "Personal Info"}
            {step === 2 && "Employment"}
            {step === 3 && "Account Setup"}
          </span>
          {step < 3 && (
            <div
              className={`${styles.stepConnector} ${
                formStep > step ? styles.stepConnectorActive : ""
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className={styles.stepContent}>
      <h3 className={styles.stepTitle}>Personal Information</h3>
      <div className={styles.inputRow}>
        <div className={styles.inputGroup}>
          <label htmlFor="firstName" className={styles.label}>
            First Name *
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            required
            className={styles.input}
            placeholder="FIRST NAME"
            autoComplete="given-name"
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="middleInitial" className={styles.label}>
            M.I.
          </label>
          <input
            type="text"
            id="middleInitial"
            name="middleInitial"
            value={formData.middleInitial}
            onChange={handleInputChange}
            className={styles.input}
            placeholder="M"
            maxLength={1}
            autoComplete="additional-name"
          />
        </div>
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="lastName" className={styles.label}>
          Last Name *
        </label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          value={formData.lastName}
          onChange={handleInputChange}
          required
          className={styles.input}
          placeholder="LAST NAME"
          autoComplete="family-name"
        />
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="email" className={styles.label}>
          Email Address *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          required
          className={styles.input}
          placeholder="your.email@company.com"
          autoComplete="email"
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className={styles.stepContent}>
      <h3 className={styles.stepTitle}>Employment Details</h3>
      <div className={styles.inputGroup}>
        <label htmlFor="employeeId" className={styles.label}>
          Employee ID *
        </label>
        <input
          type="text"
          id="employeeId"
          name="employeeId"
          value={formData.employeeId}
          onChange={handleInputChange}
          required
          className={styles.input}
          placeholder="EMP001"
          autoComplete="username"
        />
      </div>
      <div className={styles.inputRow}>
        <div className={styles.inputGroup}>
          <label htmlFor="gender" className={styles.label}>
            Gender *
          </label>
          <select
            id="gender"
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            required
            className={styles.select}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="birthdate" className={styles.label}>
            Birthdate *
          </label>
          <input
            type="date"
            id="birthdate"
            name="birthdate"
            value={formData.birthdate}
            onChange={handleInputChange}
            required
            className={styles.input}
            autoComplete="bday"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className={styles.stepContent}>
      <h3 className={styles.stepTitle}>Account Setup</h3>
      <div className={styles.inputGroup}>
        <label htmlFor="password" className={styles.label}>
          Password *
        </label>
        <div className={styles.passwordContainer}>
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            className={styles.input}
            placeholder="Minimum 6 characters"
            autoComplete="new-password"
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
            aria-label="Toggle password visibility"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="confirmPassword" className={styles.label}>
          Confirm Password *
        </label>
        <div className={styles.passwordContainer}>
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
            className={styles.input}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label="Toggle confirm password visibility"
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Left Side - Registration Form */}
        <div className={styles.formSection}>
          <div className={styles.formHeader}>
            <div className={styles.logoGroup}>
              <img
                src={assets.innoAPE}
                alt="APECentral logo"
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

          <div className={styles.registerForm}>
            <div className={styles.formTitleSection}>
              <h2 className={styles.formTitle}>Create Your Account</h2>
              <p className={styles.formDescription}>
                Join APECentral to manage your annual physical exam records
                securely.
              </p>
            </div>

            {renderStepIndicator()}

            <form onSubmit={handleSubmit} className={styles.form}>
              {formStep === 1 && renderStep1()}
              {formStep === 2 && renderStep2()}
              {formStep === 3 && renderStep3()}

              <div className={styles.buttonGroup}>
                {formStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className={styles.secondaryButton}
                    disabled={isLoading}
                  >
                    Back
                  </button>
                )}

                {formStep < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className={styles.primaryButton}
                    disabled={isLoading}
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? "Creating Account..."
                      : "Complete Registration"}
                  </button>
                )}
              </div>
            </form>

            <div className={styles.loginLink}>
              <p>
                Already have an account?{" "}
                <Link to="/login" className={styles.link}>
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Illustration */}
        <div className={styles.illustrationSection}>
          <div className={styles.illustrationContent}>
            <div className={styles.welcomeText}>
              <h2 className={styles.welcomeTitle}>Welcome to APECentral</h2>
              <p className={styles.welcomeDescription}>
                Your comprehensive platform for managing annual physical exam
                records. Secure, efficient, and designed with healthcare
                professionals in mind.
              </p>
              <div className={styles.features}>
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>🔒</div>
                  <span>Secure Data Management</span>
                </div>
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>📋</div>
                  <span>Comprehensive Records</span>
                </div>
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>👥</div>
                  <span>Team Collaboration</span>
                </div>
              </div>
            </div>

            <div className={styles.illustrationImage}>
              <div className={styles.placeholderIllustration}>
                <div className={styles.medicalIcon}>⚕️</div>
                <div className={styles.decorativeElements}>
                  <div className={styles.circle}></div>
                  <div className={styles.circle}></div>
                  <div className={styles.circle}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
