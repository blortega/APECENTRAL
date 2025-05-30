import React, { useState, useEffect } from "react";
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

  // Sync internal state with external prop
  useEffect(() => {
    setIsCollapsed(!isOpen);
  }, [isOpen]);

  const handleToggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (onToggle) {
      onToggle();
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
      description: "Overview & Statistics"
    },
    {
      path: "/records",
      icon: "📋",
      label: "Medical Records",
      description: "Complete Health History"
    },
    {
      path: "/reports",
      icon: "📈",
      label: "Reports",
      description: "Health Trends & Analysis"
    }
  ];

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
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
                    isActive(item.path) ? styles.active : ''
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

        {/* {!isCollapsed && (
          <div className={styles.healthMetrics}>
            <div className={styles.metricItem}>
              <span className={styles.metricValue}>12</span>
              <span className={styles.metricLabel}>upcoming</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricValue}>85/100</span>
              <span className={styles.metricLabel}>health score</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricValue}>45 days</span>
              <span className={styles.metricLabel}>next exam</span>
            </div>
          </div>
        )} */}
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.userSection}>
          <div className={styles.userAvatar}>JD</div>
          {!isCollapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>John Doe</span>
              <span className={styles.userEmail}>john.doe@example.com</span>
            </div>
          )}
        </div>
        {/* {!isCollapsed && (
          <p className={styles.footerText}>
            Monitor your annual physical exams, view health trends, and manage appointments all in one place.
          </p>
        )} */}
        <Link
          to="/login"
          className={`${styles.logoutButton} ${isCollapsed ? styles.logoutCollapsed : ''}`}
        >
          <span className={styles.logoutIcon}>🚪</span>
          {!isCollapsed && <span>Sign Out</span>}
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;