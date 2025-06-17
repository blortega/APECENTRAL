import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import styles from "@/styles/Dashboard.module.css";
import Sidebar from "@/components/Sidebar";

interface StatsCard {
  title: string;
  value: string | number;
  icon: string;
  trend?: string;
  trendValue?: string;
  color?: string;
}

interface RecentActivity {
  id: string;
  action: string;
  patientName: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
}

const Dashboard: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(
    []
  );
  const [xrayRecordsCount, setXrayRecordsCount] = useState(0);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Load dashboard statistics
  const loadStats = async () => {
    try {
      setLoading(true);

      const mockStats: StatsCard[] = [
        {
          title: "Total Patients",
          value: "1,248",
          icon: "👥",
          trend: "up",
          trendValue: "12%",
          color: "blue",
        },
        {
          title: "X-Ray Records",
          value: xrayRecordsCount,
          icon: "🩻",
          trend: "up",
          trendValue: "24%",
          color: "green",
        },
        {
          title: "Pending Reports",
          value: "18",
          icon: "⏳",
          trend: "down",
          trendValue: "5%",
          color: "orange",
        },
        {
          title: "Today's Uploads",
          value: "9",
          icon: "📅",
          trend: "same",
          trendValue: "0%",
          color: "purple",
        },
      ];

      setStats(mockStats);

      const activities: RecentActivity[] = [
        {
          id: "1",
          action: "X-Ray Upload",
          patientName: "John Doe",
          timestamp: "10 mins ago",
          status: "completed",
        },
        {
          id: "2",
          action: "Report Generation",
          patientName: "Jane Smith",
          timestamp: "25 mins ago",
          status: "completed",
        },
        {
          id: "3",
          action: "X-Ray Analysis",
          patientName: "Robert Johnson",
          timestamp: "1 hour ago",
          status: "pending",
        },
        {
          id: "4",
          action: "Record Update",
          patientName: "Emily Davis",
          timestamp: "2 hours ago",
          status: "completed",
        },
        {
          id: "5",
          action: "System Backup",
          patientName: "System",
          timestamp: "3 hours ago",
          status: "completed",
        },
      ];

      setRecentActivities(activities);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load count of X-Ray records
  const loadXrayRecordsCount = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "xrayRecords"));
      setXrayRecordsCount(querySnapshot.size);
    } catch (error) {
      console.error("Error loading X-Ray records count:", error);
    }
  };

  useEffect(() => {
    loadXrayRecordsCount();
    loadStats();
  }, [xrayRecordsCount]);

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div
        className={`${styles.contentWrapper} ${
          isSidebarCollapsed ? styles.collapsed : ""
        }`}
      >
        {/* Header Section */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerText}>
              <h1 className={styles.pageTitle}>
                Medical Dashboard
                <span className={styles.titleAccent}>Admin</span>
              </h1>
              <p className={styles.pageDescription}>
                Comprehensive overview of your medical practice
              </p>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.refreshBtn}>
                <span className={styles.refreshIcon}>🔄</span>
                Refresh
              </button>
              <div className={styles.lastUpdated}>
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </header>

        <main className={styles.mainContent}>
          {/* Loading Overlay */}
          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
            </div>
          )}

          {/* Stats Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>📊</span>
                Key Metrics
              </h2>
              <p className={styles.sectionDescription}>
                Real-time performance indicators
              </p>
            </div>

            <div className={styles.statsGrid}>
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className={`${styles.statCard} ${
                    styles[stat.color || "default"]
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={styles.statCardInner}>
                    <div className={styles.statHeader}>
                      <div className={styles.statIcon}>{stat.icon}</div>
                      {stat.trend && (
                        <div
                          className={`${styles.statTrend} ${
                            styles[stat.trend]
                          }`}
                        >
                          <span className={styles.trendIcon}>
                            {stat.trend === "up"
                              ? "↗"
                              : stat.trend === "down"
                              ? "↘"
                              : "→"}
                          </span>
                          {stat.trendValue}
                        </div>
                      )}
                    </div>
                    <div className={styles.statContent}>
                      <h3 className={styles.statTitle}>{stat.title}</h3>
                      <p className={styles.statValue}>{stat.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Activities Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>⚡</span>
                Recent Activities
              </h2>
              <p className={styles.sectionDescription}>
                Latest system events and patient interactions
              </p>
            </div>

            <div className={styles.activitiesContainer}>
              <div className={styles.activitiesList}>
                {recentActivities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className={styles.activityItem}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div
                      className={`${styles.activityIcon} ${
                        styles[activity.status]
                      }`}
                    >
                      {activity.status === "completed"
                        ? "✓"
                        : activity.status === "pending"
                        ? "⏳"
                        : "⚠️"}
                    </div>
                    <div className={styles.activityContent}>
                      <div className={styles.activityHeader}>
                        <h4 className={styles.activityAction}>
                          {activity.action}
                        </h4>
                        <span className={styles.activityTimestamp}>
                          {activity.timestamp}
                        </span>
                      </div>
                      <p className={styles.activityPatient}>
                        Patient: {activity.patientName}
                      </p>
                    </div>
                    <div
                      className={`${styles.activityStatus} ${
                        styles[activity.status]
                      }`}
                    >
                      {activity.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Quick Actions Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>🚀</span>
                Quick Actions
              </h2>
              <p className={styles.sectionDescription}>
                Streamline your workflow with one-click actions
              </p>
            </div>

            <div className={styles.quickActionsGrid}>
              <button className={`${styles.quickAction} ${styles.primary}`}>
                <div className={styles.actionIconWrapper}>
                  <span className={styles.actionIcon}>🩺</span>
                </div>
                <div className={styles.actionContent}>
                  <span className={styles.actionText}>New Patient</span>
                  <span className={styles.actionSubtext}>
                    Add patient record
                  </span>
                </div>
              </button>
              <button className={`${styles.quickAction} ${styles.secondary}`}>
                <div className={styles.actionIconWrapper}>
                  <span className={styles.actionIcon}>🩻</span>
                </div>
                <div className={styles.actionContent}>
                  <span className={styles.actionText}>Upload X-Ray</span>
                  <span className={styles.actionSubtext}>
                    Import medical images
                  </span>
                </div>
              </button>
              <button className={`${styles.quickAction} ${styles.accent}`}>
                <div className={styles.actionIconWrapper}>
                  <span className={styles.actionIcon}>📝</span>
                </div>
                <div className={styles.actionContent}>
                  <span className={styles.actionText}>Create Report</span>
                  <span className={styles.actionSubtext}>
                    Generate analysis
                  </span>
                </div>
              </button>
              <button className={`${styles.quickAction} ${styles.info}`}>
                <div className={styles.actionIconWrapper}>
                  <span className={styles.actionIcon}>🔍</span>
                </div>
                <div className={styles.actionContent}>
                  <span className={styles.actionText}>Search Records</span>
                  <span className={styles.actionSubtext}>
                    Find patient data
                  </span>
                </div>
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
