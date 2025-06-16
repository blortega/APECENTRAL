import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/firebaseConfig";
import styles from "@/styles/Sidebar.module.css";
import { assets } from "@/components/assets";

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

interface UserData {
  email: string;
  lastname: string;
  firstname: string;
  employeeId: string;
  role: string;
  // Include other fields that exist in your document
  birthdate?: string;
  createdAt?: string;
  gender?: string;
  middleinitial?: string;
  uid?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onToggle }) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(!isOpen);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRecordsDropdownOpen, setIsRecordsDropdownOpen] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const recordsDropdownRef = useRef<HTMLLIElement>(null);

  // Fetch user data when authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Query the users collection to find the user document by email
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", user.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Get the first matching document
            const userDoc = querySnapshot.docs[0];
            const data = userDoc.data();

            setUserData({
              email: data.email || user.email || "",
              lastname: data.lastname || "",
              firstname: data.firstname || "",
              employeeId: data.employeeId || "",
              role: data.role || "Employee",
              // Include other fields as needed
              birthdate: data.birthdate,
              createdAt: data.createdAt,
              gender: data.gender,
              middleinitial: data.middleinitial,
              uid: data.uid,
            });
          } else {
            console.error("User document not found");
            // Fallback to auth user data
            setUserData({
              email: user.email || "",
              lastname: "",
              firstname: "",
              employeeId: "",
              role: "Employee",
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Fallback to auth user data
          setUserData({
            email: user.email || "",
            lastname: "",
            firstname: "",
            employeeId: "",
            role: "Employee",
          });
        }
      } else {
        setUserData(null);
      }
      setIsLoadingUser(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync internal state with external prop
  useEffect(() => {
    setIsCollapsed(!isOpen);
  }, [isOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }

      if (
        recordsDropdownRef.current &&
        !recordsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRecordsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (onToggle) {
      onToggle();
    }
  };

  const handleDropdownToggle = () => {
    if (!isCollapsed) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  const handleRecordsDropdownToggle = () => {
    if (!isCollapsed) {
      setIsRecordsDropdownOpen(!isRecordsDropdownOpen);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const isRecordsActive = () => {
    const recordsPaths = [
      "/records",
      "/records/cbc",
      "/records/xray",
      "/records/ecg",
    ];
    return recordsPaths.some((path) => location.pathname === path);
  };

  // Generate user initials for avatar (using lastname only)
  const getUserInitials = () => {
    if (!userData) return "U";

    if (userData.lastname) {
      // Use first two letters of lastname, or first letter if lastname is short
      return userData.lastname.length >= 2
        ? userData.lastname.substring(0, 2).toUpperCase()
        : userData.lastname.charAt(0).toUpperCase();
    } else {
      // Fallback to first letter of email
      return userData.email ? userData.email.charAt(0).toUpperCase() : "U";
    }
  };

  // Get display name (prioritize lastname, then firstname, then email)
  const getDisplayName = () => {
    if (!userData) return "Loading...";

    if (userData.lastname) {
      return userData.lastname;
    } else if (userData.firstname) {
      return userData.firstname;
    } else {
      return userData.email.split("@")[0];
    }
  };

  const menuItems = [
    {
      path: "/dashboard",
      icon: "📊",
      label: "Dashboard",
      description: "Overview & Statistics",
    },
    {
      path: "/reports",
      icon: "📈",
      label: "Reports",
      description: "Health Trends & Analysis",
    },
  ];

  const recordsSubItems = [
    {
      path: "/cbc",
      icon: "🩸",
      label: "CBC",
      description: "Complete Blood Count",
    },
    {
      path: "/xray",
      icon: "🩻",
      label: "X-Ray",
      description: "Radiographic Images",
    },
    {
      path: "/ecg",
      icon: "💓",
      label: "ECG",
      description: "Electrocardiogram",
    },
  ];

  const dropdownItems = [
    {
      path: "/profile",
      icon: "👤",
      label: "Profile Settings",
    },
    {
      path: "/preferences",
      icon: "⚙️",
      label: "Preferences",
    },
    {
      path: "/help",
      icon: "❓",
      label: "Help & Support",
    },
    {
      path: "/login",
      icon: "🚪",
      label: "Sign Out",
      isSignOut: true,
    },
  ];

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}
    >
      <div className={styles.sidebarHeader}>
        <div className={styles.logoSection}>
          <img
            src={assets.innoAPE}
            alt="APE Central logo"
            className={styles.logo}
          />
          {!isCollapsed && (
            <div className={styles.branding}>
              <h1 className={styles.brandName}>APECentral</h1>
              <p className={styles.brandSubtitle}>by Innodata</p>
            </div>
          )}
        </div>
        <button
          onClick={handleToggleCollapse}
          className={styles.toggleButton}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? "→" : "←"}
        </button>
      </div>

      <div className={styles.sidebarContent}>
        <nav className={styles.navigation}>
          <h2 className={styles.sectionTitle}>Dashboard</h2>
          <p className={styles.sectionDescription}>Overview & Statistics</p>

          <ul className={styles.menuList}>
            {menuItems.map((item) => (
              <li key={item.path} className={styles.menuItem}>
                <Link
                  to={item.path}
                  className={`${styles.menuLink} ${
                    isActive(item.path) ? styles.active : ""
                  }`}
                >
                  <span className={styles.menuIcon}>{item.icon}</span>
                  {!isCollapsed && (
                    <div className={styles.menuContent}>
                      <span className={styles.menuLabel}>{item.label}</span>
                      <span className={styles.menuDescription}>
                        {item.description}
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            ))}

            {/* Medical Records with Dropdown */}
            <li className={styles.menuItem} ref={recordsDropdownRef}>
              <div
                className={`${styles.menuLink} ${styles.dropdownParent} ${
                  isRecordsActive() ? styles.active : ""
                }`}
                onClick={handleRecordsDropdownToggle}
              >
                <span className={styles.menuIcon}>📋</span>
                {!isCollapsed && (
                  <>
                    <div className={styles.menuContent}>
                      <span className={styles.menuLabel}>Medical Records</span>
                      <span className={styles.menuDescription}>
                        Complete Health History
                      </span>
                    </div>
                    <div
                      className={`${styles.dropdownToggle} ${
                        isRecordsDropdownOpen ? styles.dropdownToggleOpen : ""
                      }`}
                    >
                      ⌄
                    </div>
                  </>
                )}
              </div>

              {/* Records Submenu */}
              {!isCollapsed && (
                <div
                  className={`${styles.submenu} ${
                    isRecordsDropdownOpen ? styles.submenuOpen : ""
                  }`}
                >
                  <ul className={styles.submenuList}>
                    <li className={styles.submenuItem}>
                      <Link
                        to="/records"
                        className={`${styles.submenuLink} ${
                          isActive("/records") ? styles.active : ""
                        }`}
                        onClick={() => setIsRecordsDropdownOpen(false)}
                      >
                        <span className={styles.submenuIcon}>📋</span>
                        <div className={styles.submenuContent}>
                          <span className={styles.submenuLabel}>
                            All Records
                          </span>
                          <span className={styles.submenuDescription}>
                            View All Medical Records
                          </span>
                        </div>
                      </Link>
                    </li>
                    {recordsSubItems.map((item) => (
                      <li key={item.path} className={styles.submenuItem}>
                        <Link
                          to={item.path}
                          className={`${styles.submenuLink} ${
                            isActive(item.path) ? styles.active : ""
                          }`}
                          onClick={() => setIsRecordsDropdownOpen(false)}
                        >
                          <span className={styles.submenuIcon}>
                            {item.icon}
                          </span>
                          <div className={styles.submenuContent}>
                            <span className={styles.submenuLabel}>
                              {item.label}
                            </span>
                            <span className={styles.submenuDescription}>
                              {item.description}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          </ul>
        </nav>
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.userSection} ref={dropdownRef}>
          <div
            className={`${styles.userContainer} ${
              isDropdownOpen ? styles.userContainerActive : ""
            }`}
            onClick={handleDropdownToggle}
          >
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                {isLoadingUser ? "..." : getUserInitials()}
              </div>
              {!isCollapsed && (
                <div className={styles.userDetails}>
                  <span className={styles.userName}>
                    {isLoadingUser ? "Loading..." : getDisplayName()}
                  </span>
                  <span className={styles.userEmail}>
                    {isLoadingUser ? "Loading..." : userData?.email || ""}
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <div
                className={`${styles.dropdownArrow} ${
                  isDropdownOpen ? styles.dropdownArrowOpen : ""
                }`}
              >
                ⌄
              </div>
            )}
          </div>

          {/* Dropdown Menu */}
          {!isCollapsed && (
            <div
              className={`${styles.dropdown} ${
                isDropdownOpen ? styles.dropdownOpen : ""
              }`}
            >
              <ul className={styles.dropdownList}>
                {dropdownItems.map((item) => (
                  <li key={item.path} className={styles.dropdownItem}>
                    <Link
                      to={item.path}
                      className={`${styles.dropdownLink} ${
                        item.isSignOut ? styles.signOutLink : ""
                      }`}
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <span className={styles.dropdownIcon}>{item.icon}</span>
                      <span className={styles.dropdownLabel}>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
