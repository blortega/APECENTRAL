import React, { useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebaseConfig";
import styles from "@/styles/XRay.module.css";
import Sidebar from "@/components/Sidebar";

interface EcgRecord {
  id?: string;
  uniqueId: string;
  pid_no: string;
  date: string;
  patient_name: string;
  referring_physician: string;
  hr: string;
  bp: string;
  age: string;
  sex: string;
  birth_date: string;
  qrs: string;
  qt_qtc: string;
  pr: string;
  p: string;
  rr_pp: string;
  pqrst: string;
  interpretation: string;
  fileName: string;
  uploadDate: string;
}

interface UserData {
  firstname: string;
  lastname: string;
  role: string;
  employeeId: string;
}

const EcgUser: React.FC = () => {
  const [user, loading, error] = useAuthState(auth);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<EcgRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<EcgRecord | null>(null);
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

      // Construct the full name to match against patient_name
      // Format: "FIRSTNAME LASTNAME" (assuming middle initial might be present)
      const userFullName =
        `${currentUserData.firstname} ${currentUserData.lastname}`.toUpperCase();

      // Get all ECG records
      const querySnapshot = await getDocs(collection(db, "ecgRecords"));
      const loadedRecords: EcgRecord[] = [];

      querySnapshot.forEach((doc) => {
        const recordData = { id: doc.id, ...doc.data() } as EcgRecord;

        // Only include records that belong to the current user
        // Match by patient name (case-insensitive)
        // Handle cases where middle name/initial might be present
        const patientName = recordData.patient_name?.toUpperCase() || "";
        const firstName = currentUserData.firstname.toUpperCase();
        const lastName = currentUserData.lastname.toUpperCase();

        // Check if patient name contains both first and last name
        const matchesUser =
          patientName.includes(firstName) && patientName.includes(lastName);

        if (matchesUser) {
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
      record.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.pid_no?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <p>Please log in to view your ECG records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>My ECG Records</h1>
          <p className={styles.pageDescription}>
            {userData && (
              <>
                View your ECG examination records and medical reports,{" "}
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
                placeholder="Search your records by ID, PID number, or examination type..."
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
                  Your personal ECG examination results
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
                    ? "You don't have any ECG records yet."
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
                          {record.patient_name}
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
                        <span className={styles.recordLabel}>PID NO:</span>
                        <span className={styles.recordValue}>
                          {record.pid_no}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Age:</span>
                        <span className={styles.recordValue}>{record.age}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Gender:</span>
                        <span className={styles.recordValue}>{record.sex}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Report Date:</span>
                        <span className={styles.recordValue}>
                          {record.date}
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
              <h3 className={styles.modalTitle}>ECG Report Details</h3>
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
                      {selectedRecord.patient_name}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date of Birth:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.birth_date}
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
                      {selectedRecord.sex}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Unique ID:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.uniqueId}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>PID NO:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.pid_no}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Examination Details</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Report Date:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.date}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>
                      Referring Physician:
                    </span>
                    <span className={styles.infoValue}>
                      {selectedRecord.referring_physician}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>HR:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.hr}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>BP:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.bp}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>ECG Measurements</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>QRS:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.qrs}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>QT/QTc:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.qt_qtc}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>PR:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.pr}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>P:</span>
                    <span className={styles.infoValue}>{selectedRecord.p}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>RR/PP:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.rr_pp}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>P/QRS/T:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.pqrst}
                    </span>
                  </div>
                </div>
              </div>

              {selectedRecord.interpretation && (
                <div className={styles.interpretationSection}>
                  <h4 className={styles.sectionSubtitle}>
                    Medical Interpretation
                  </h4>
                  <div className={styles.interpretationText}>
                    {selectedRecord.interpretation}
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

export default EcgUser;
