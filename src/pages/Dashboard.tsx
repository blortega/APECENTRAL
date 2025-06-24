import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/firebaseConfig";
import { useAuthState } from "react-firebase-hooks/auth";
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
  userName: string;
  reportDetails: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
}

interface FirestoreActivity {
  id: string;
  firstname: string;
  report: string;
  reportDate: Timestamp;
}

const Dashboard: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(
    []
  );
  const [xrayRecordsCount, setXrayRecordsCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [last24HrReportsCount, setLast24HrReportsCount] = useState(0);
  const [todaysUploadsCount, setTodaysUploadsCount] = useState(0);
  const [userRole, setUserRole] = useState<string>("User");
  const [user, userLoading] = useAuthState(auth);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Load current user's role
  const loadUserRole = async () => {
    if (!user?.uid) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserRole(userData.role || "User");
      }
    } catch (error) {
      console.error("Error loading user role:", error);
      setUserRole("User"); // Fallback to default
    }
  };

  // Load count of users with "Employee" role
  const loadEmployeeCount = async () => {
    try {
      const employeeQuery = query(
        collection(db, "users"),
        where("role", "==", "Employee")
      );
      const querySnapshot = await getDocs(employeeQuery);
      setEmployeeCount(querySnapshot.size);
    } catch (error) {
      console.error("Error loading employee count:", error);
      setEmployeeCount(0); // Fallback to 0 on error
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

  // Load count of activities/reports from the last 24 hours
  const loadLast24HrReportsCount = async () => {
    try {
      // Calculate timestamp for 24 hours ago
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twentyFourHoursAgoTimestamp =
        Timestamp.fromDate(twentyFourHoursAgo);

      // Query activities from the last 24 hours
      const recentActivitiesQuery = query(
        collection(db, "activities"),
        where("reportDate", ">=", twentyFourHoursAgoTimestamp),
        orderBy("reportDate", "desc")
      );

      const querySnapshot = await getDocs(recentActivitiesQuery);
      setLast24HrReportsCount(querySnapshot.size);
    } catch (error) {
      console.error("Error loading 24-hour reports count:", error);
      setLast24HrReportsCount(0);
    }
  };

  // Load count of activities/reports from the last 24 hours with "Added" or "Uploaded" keywords
  const loadTodaysUploadsCount = async () => {
    try {
      // Calculate timestamp for 24 hours ago
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twentyFourHoursAgoTimestamp =
        Timestamp.fromDate(twentyFourHoursAgo);

      // Query activities from the last 24 hours
      const recentActivitiesQuery = query(
        collection(db, "activities"),
        where("reportDate", ">=", twentyFourHoursAgoTimestamp),
        orderBy("reportDate", "desc")
      );

      const querySnapshot = await getDocs(recentActivitiesQuery);
      let uploadsCount = 0;

      // Filter activities that contain "Added" or "Uploaded" keywords
      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirestoreActivity;
        const report = data.report.toLowerCase();

        if (report.includes("added") || report.includes("uploaded")) {
          uploadsCount++;
        }
      });

      setTodaysUploadsCount(uploadsCount);
    } catch (error) {
      console.error("Error loading today's uploads count:", error);
      setTodaysUploadsCount(0);
    }
  };

  // Load recent activities from Firestore
  const loadRecentActivities = async () => {
    try {
      const activitiesQuery = query(
        collection(db, "activities"),
        orderBy("reportDate", "desc"),
        limit(5)
      );

      const querySnapshot = await getDocs(activitiesQuery);
      const activities: RecentActivity[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FirestoreActivity;

        // Convert Firestore timestamp to relative time
        const now = new Date();
        const activityDate = data.reportDate.toDate();
        const timeDiff = now.getTime() - activityDate.getTime();

        let timeString = "";
        if (timeDiff < 60000) {
          // Less than 1 minute
          timeString = "Just now";
        } else if (timeDiff < 3600000) {
          // Less than 1 hour
          const minutes = Math.floor(timeDiff / 60000);
          timeString = `${minutes} min${minutes > 1 ? "s" : ""} ago`;
        } else if (timeDiff < 86400000) {
          // Less than 24 hours
          const hours = Math.floor(timeDiff / 3600000);
          timeString = `${hours} hour${hours > 1 ? "s" : ""} ago`;
        } else {
          // More than 24 hours
          const days = Math.floor(timeDiff / 86400000);
          timeString = `${days} day${days > 1 ? "s" : ""} ago`;
        }

        // Determine action type based on report content
        let action = "Record Update";
        if (data.report.toLowerCase().includes("cbc")) {
          action = "CBC Record Added";
        } else if (data.report.toLowerCase().includes("x-ray")) {
          action = "X-Ray Record Added";
        } else if (data.report.toLowerCase().includes("upload")) {
          action = "File Upload";
        } else if (data.report.toLowerCase().includes("analysis")) {
          action = "Medical Analysis";
        } else if (data.report.toLowerCase().includes("added")) {
          action = "Record Added";
        }

        // Extract patient info from report if available
        let reportDetails = data.report;
        // Simplify the report for display - extract patient name if available
        const patientMatch = data.report.match(/for ([A-Z\s]+) \(/);
        if (patientMatch) {
          reportDetails = `for ${patientMatch[1]}`;
        }

        // Assume completed status for existing records
        // You can modify this logic based on your data structure
        const status: "completed" | "pending" | "failed" = "completed";

        activities.push({
          id: doc.id,
          action: action,
          userName: data.firstname,
          reportDetails: reportDetails,
          timestamp: timeString,
          status: status,
        });
      });

      setRecentActivities(activities);
    } catch (error) {
      console.error("Error loading recent activities:", error);
      // Fallback to empty array on error
      setRecentActivities([]);
    }
  };

  // Load dashboard statistics
  const loadStats = async () => {
    try {
      setLoading(true);

      // Calculate trend for 24-hour reports
      const trendDirection =
        last24HrReportsCount > 5
          ? "up"
          : last24HrReportsCount > 0
          ? "same"
          : "down";

      // Calculate trend for today's uploads
      const uploadsTrendDirection =
        todaysUploadsCount > 3
          ? "up"
          : todaysUploadsCount > 0
          ? "same"
          : "down";

      const mockStats: StatsCard[] = [
        {
          title: "Total Patients",
          value: employeeCount,
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
          title: "24 Hr Reports",
          value: last24HrReportsCount,
          icon: "📊",
          trend: trendDirection,
          trendValue:
            last24HrReportsCount === 0 ? "0%" : `${last24HrReportsCount} new`,
          color: "orange",
        },
        {
          title: "24 Hr Uploads",
          value: todaysUploadsCount,
          icon: "📅",
          trend: uploadsTrendDirection,
          trendValue:
            todaysUploadsCount === 0 ? "0%" : `${todaysUploadsCount} new`,
          color: "purple",
        },
      ];

      setStats(mockStats);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !userLoading) {
      loadUserRole();
    }
  }, [user, userLoading]);

  useEffect(() => {
    const loadDashboardData = async () => {
      await Promise.all([
        loadXrayRecordsCount(),
        loadEmployeeCount(),
        loadLast24HrReportsCount(),
        loadTodaysUploadsCount(),
        loadRecentActivities(),
      ]);
    };

    loadDashboardData();
  }, []); // Load data on component mount

  // Update stats whenever counts change
  useEffect(() => {
    loadStats();
  }, [
    employeeCount,
    xrayRecordsCount,
    last24HrReportsCount,
    todaysUploadsCount,
  ]);

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
                <span className={styles.titleAccent}>{userRole}</span>
              </h1>
              <p className={styles.pageDescription}>
                Comprehensive overview of your medical practice
              </p>
            </div>
            <div className={styles.headerActions}>
              <button
                className={styles.refreshBtn}
                onClick={() => {
                  loadRecentActivities();
                  loadXrayRecordsCount();
                  loadEmployeeCount();
                  loadLast24HrReportsCount();
                  loadTodaysUploadsCount();
                }}
              >
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
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
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
                        <p className={styles.activityDetails}>
                          By: {activity.userName} • {activity.reportDetails}
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
                  ))
                ) : (
                  <div className={styles.noActivities}>
                    <p>No recent activities found.</p>
                  </div>
                )}
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
