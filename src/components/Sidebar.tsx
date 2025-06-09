import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "@/styles/Sidebar.module.css";
import { assets } from "@/components/assets";

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onToggle }) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(!isOpen);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal state with external prop
  useEffect(() => {
    setIsCollapsed(!isOpen);
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
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

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const menuItems = [
    {
      path: "/dashboard",
      icon: "📊",
      label: "Dashboard",
      description: "Overview & Statistics",
    },
    {
      path: "/records",
      icon: "📋",
      label: "Medical Records",
      description: "Complete Health History",
    },
    {
      path: "/reports",
      icon: "📈",
      label: "Reports",
      description: "Health Trends & Analysis",
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
              <div className={styles.userAvatar}>JD</div>
              {!isCollapsed && (
                <div className={styles.userDetails}>
                  <span className={styles.userName}>John Doe</span>
                  <span className={styles.userEmail}>john.doe@example.com</span>
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
