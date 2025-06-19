import React, { useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebaseConfig";
import styles from "@/styles/XRay.module.css";
import Sidebar from "@/components/Sidebar";

interface XRayRecord {
  id?: string;
  uniqueId: string;
  patientName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  company: string;
  examination: string;
  interpretation: string;
  impression: string;
  reportDate: string;
  fileName: string;
  uploadDate: string;
}

interface UserData {
  firstname: string;
  lastname: string;
  role: string;
  employeeId: string;
}

const XrayUser: React.FC = () => {
  const [user, loading, error] = useAuthState(auth);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<XRayRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<XRayRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Get current user's data from Firestore
  const getCurrentUserData = async (
    userId: string
  ): Promise<UserData | null> => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserData;
        return data;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  };

  // Load records filtered by current user
  const loadRecords = async () => {
    if (!user) {
      console.error("No authenticated user");
      return;
    }

    try {
      setLoadingRecords(true);

      // Get current user's data first
      const currentUserData = await getCurrentUserData(user.uid);
      if (!currentUserData) {
        console.error("Could not fetch user data");
        return;
      }

      setUserData(currentUserData);

      // Construct the full name to match against patientName
      const userFullName =
        `${currentUserData.lastname}, ${currentUserData.firstname}`.toUpperCase();

      // Get all X-ray records
      const querySnapshot = await getDocs(collection(db, "xrayRecords"));
      const loadedRecords: XRayRecord[] = [];

      querySnapshot.forEach((doc) => {
        const recordData = { id: doc.id, ...doc.data() } as XRayRecord;

        // Only include records that belong to the current user
        // Match by patient name (case-insensitive)
        if (recordData.patientName?.toUpperCase() === userFullName) {
          loadedRecords.push(recordData);
        }
      });

      // Sort by upload date (newest first)
      loadedRecords.sort(
        (a, b) =>
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      );

      setRecords(loadedRecords);
    } catch (error) {
      console.error("Error loading records:", error);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Filter records based on search (only within user's own records)
  const filteredRecords = records.filter(
    (record) =>
      record.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load records when user is authenticated and component mounts
  React.useEffect(() => {
    if (user && !loading) {
      loadRecords();
    }
  }, [user, loading]);

  // Show loading state while authenticating
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show error or redirect if not authenticated
  if (error || !user) {
    return (
      <div className={styles.page}>
        <div className={styles.errorContainer}>
          <p>Please log in to view your X-ray records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>My X-Ray Records</h1>
          <p className={styles.pageDescription}>
            {userData && (
              <>
                View your X-ray examination records and medical reports,{" "}
                {userData.firstname}
              </>
            )}
          </p>
        </div>

        <main className={styles.mainContent}>
          {/* Search Section */}
          <section className={styles.searchSection}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search your records by ID, company, or examination type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <div className={styles.searchIcon}>🔍</div>
            </div>
          </section>

          {/* Records Section */}
          <section className={styles.recordsSection}>
            <div className={styles.recordsHeader}>
              <div className={styles.recordsTitle}>
                <h2 className={styles.sectionTitle}>
                  Your Records ({filteredRecords.length})
                </h2>
                <p className={styles.recordsSubtitle}>
                  Your personal X-ray examination results
                </p>
              </div>
              <button
                onClick={loadRecords}
                className={styles.refreshButton}
                disabled={loadingRecords}
              >
                {loadingRecords ? "Loading..." : "Refresh"}
              </button>
            </div>

            {filteredRecords.length === 0 ? (
              <div className={styles.noRecords}>
                <div className={styles.noRecordsIcon}>📋</div>
                <h3 className={styles.noRecordsTitle}>
                  {records.length === 0
                    ? "No Records Found"
                    : "No Matching Records"}
                </h3>
                <p className={styles.noRecordsText}>
                  {records.length === 0
                    ? "You don't have any X-ray records yet."
                    : "No records match your search criteria."}
                </p>
              </div>
            ) : (
              <div className={styles.recordsGrid}>
                {filteredRecords.map((record) => (
                  <div key={record.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <div className={styles.patientInfo}>
                        <h3 className={styles.patientName}>
                          {record.patientName}
                        </h3>
                        <p className={styles.uniqueId}>{record.uniqueId}</p>
                      </div>
                      <div className={styles.recordActions}>
                        <button
                          onClick={() => {
                            setSelectedRecord(record);
                            setShowModal(true);
                          }}
                          className={styles.viewButton}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                    <div className={styles.recordDetails}>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Age:</span>
                        <span className={styles.recordValue}>{record.age}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Gender:</span>
                        <span className={styles.recordValue}>
                          {record.gender}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Company:</span>
                        <span className={styles.recordValue}>
                          {record.company}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Report Date:</span>
                        <span className={styles.recordValue}>
                          {record.reportDate}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modal for viewing full record */}
      {showModal && selectedRecord && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>X-Ray Report Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.patientSection}>
                <h4 className={styles.sectionSubtitle}>Patient Information</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Name:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.patientName}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date of Birth:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.dateOfBirth}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Age:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.age}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Gender:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.gender}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Company:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.company}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Unique ID:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.uniqueId}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Examination Details</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Type:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.examination}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Report Date:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.reportDate}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.interpretationSection}>
                <h4 className={styles.sectionSubtitle}>
                  Medical Interpretation
                </h4>
                <div className={styles.interpretationText}>
                  {selectedRecord.interpretation}
                </div>
              </div>

              {selectedRecord.impression && (
                <div className={styles.impressionSection}>
                  <h4 className={styles.sectionSubtitle}>
                    Clinical Impression
                  </h4>
                  <div className={styles.impressionText}>
                    {selectedRecord.impression}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default XrayUser;
