import React, { useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebaseConfig";
import styles from "@/styles/XRay.module.css";
import Sidebar from "@/components/Sidebar";

interface CBCValue {
  result: string;
  unit: string;
  reference_range: string;
}

interface CBCRecord {
  id?: string;
  uniqueId: string;
  patientName: string;
  mrn: string;
  gender: string;
  age: number;
  dob: string;
  collectionDateTime: string;
  resultValidated: string;
  rbc: CBCValue;
  hemoglobin: CBCValue;
  hematocrit: CBCValue;
  mcv: CBCValue;
  mch: CBCValue;
  mchc: CBCValue;
  rdw: CBCValue;
  platelets: CBCValue;
  mpv: CBCValue;
  wbc: CBCValue;
  neutrophils_percent: CBCValue;
  lymphocytes_percent: CBCValue;
  monocytes_percent: CBCValue;
  eosinophils_percent: CBCValue;
  basophils_percent: CBCValue;
  total_percent: CBCValue;
  neutrophils_abs: CBCValue;
  lymphocytes_abs: CBCValue;
  monocytes_abs: CBCValue;
  eosinophils_abs: CBCValue;
  basophils_abs: CBCValue;
  fileName: string;
  uploadDate: string;
}

interface UserData {
  firstname: string;
  lastname: string;
  role: string;
  employeeId: string;
}

const CbcUser: React.FC = () => {
  const [user, loading, error] = useAuthState(auth);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<CBCRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CBCRecord | null>(null);
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

      // Construct the full name to match against patient name
      // Format: "FIRSTNAME LASTNAME" (assuming middle initial might be present)
      const userFullName =
        `${currentUserData.firstname} ${currentUserData.lastname}`.toUpperCase();

      // Get all CBC records
      const querySnapshot = await getDocs(collection(db, "cbcRecords"));
      const loadedRecords: CBCRecord[] = [];

      querySnapshot.forEach((doc) => {
        const recordData = { id: doc.id, ...doc.data() } as CBCRecord;

        // Only include records that belong to the current user
        // Match by patient name (case-insensitive)
        // Handle cases where middle name/initial might be present
        const patientName = recordData.patientName?.toUpperCase() || "";
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
      record.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <p>Please log in to view your CBC records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>My CBC Records</h1>
          <p className={styles.pageDescription}>
            {userData && (
              <>
                View your Complete Blood Count (CBC) lab results,{" "}
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
                placeholder="Search your records by name, ID, or MRN..."
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
                  Your personal CBC lab results
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
                    ? "You don't have any CBC records yet."
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
                        <span className={styles.recordLabel}>Report Date:</span>
                        <span className={styles.recordValue}>
                          {record.collectionDateTime}
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
              <h3 className={styles.modalTitle}>CBC Result Details</h3>
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
                      {selectedRecord.dob}
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
                    <span className={styles.infoLabel}>Unique ID:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.uniqueId}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>MRN:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.mrn}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Report Date:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.collectionDateTime}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>COMPLETE BLOOD COUNT</h4>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>RBC Count:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.rbc.result} {selectedRecord.rbc.unit}{" "}
                    (Range: {selectedRecord.rbc.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Hematocrit:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.hematocrit.result}{" "}
                    {selectedRecord.hematocrit.unit} (Range:{" "}
                    {selectedRecord.hematocrit.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Hemoglobin:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.hemoglobin.result}{" "}
                    {selectedRecord.hemoglobin.unit} (Range:{" "}
                    {selectedRecord.hemoglobin.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCV:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.mcv.result} {selectedRecord.mcv.unit}{" "}
                    (Range: {selectedRecord.mcv.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCH:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.mch.result} {selectedRecord.mch.unit}{" "}
                    (Range: {selectedRecord.mch.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCHC:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.mchc.result} {selectedRecord.mchc.unit}{" "}
                    (Range: {selectedRecord.mchc.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>RDW:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.rdw.result} {selectedRecord.rdw.unit}{" "}
                    (Range: {selectedRecord.rdw.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Platelet Count:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.platelets.result}{" "}
                    {selectedRecord.platelets.unit} (Range:{" "}
                    {selectedRecord.platelets.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MPV:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.mpv.result} {selectedRecord.mpv.unit}{" "}
                    (Range: {selectedRecord.mpv.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>WBC Count:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.wbc.result} {selectedRecord.wbc.unit}{" "}
                    (Range: {selectedRecord.wbc.reference_range})
                  </span>
                </div>

                <h4 className={styles.sectionSubtitle}>
                  WBC Differential Count
                </h4>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Neutrophil:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.neutrophils_percent.result}{" "}
                    {selectedRecord.neutrophils_percent.unit} (Range:{" "}
                    {selectedRecord.neutrophils_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Lymphocytes:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.lymphocytes_percent.result}{" "}
                    {selectedRecord.lymphocytes_percent.unit} (Range:{" "}
                    {selectedRecord.lymphocytes_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Monocytes:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.monocytes_percent.result}{" "}
                    {selectedRecord.monocytes_percent.unit} (Range:{" "}
                    {selectedRecord.monocytes_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Eosinophil:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.eosinophils_percent.result}{" "}
                    {selectedRecord.eosinophils_percent.unit} (Range:{" "}
                    {selectedRecord.eosinophils_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Basophil:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.basophils_percent.result}{" "}
                    {selectedRecord.basophils_percent.unit} (Range:{" "}
                    {selectedRecord.basophils_percent.reference_range})
                  </span>
                </div>

                <h4 className={styles.sectionSubtitle}>WBC Absolute Count</h4>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Neutrophil:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.neutrophils_abs?.result || "N/A"}{" "}
                    {selectedRecord.neutrophils_abs?.unit || ""}{" "}
                    {selectedRecord.neutrophils_abs?.reference_range &&
                      `(Range: ${selectedRecord.neutrophils_abs.reference_range})`}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Lymphocyte:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.lymphocytes_abs?.result || "N/A"}{" "}
                    {selectedRecord.lymphocytes_abs?.unit || ""}{" "}
                    {selectedRecord.lymphocytes_abs?.reference_range &&
                      `(Range: ${selectedRecord.lymphocytes_abs.reference_range})`}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Monocyte:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.monocytes_abs?.result || "N/A"}{" "}
                    {selectedRecord.monocytes_abs?.unit || ""}{" "}
                    {selectedRecord.monocytes_abs?.reference_range &&
                      `(Range: ${selectedRecord.monocytes_abs.reference_range})`}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Eosinophil:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.eosinophils_abs?.result || "N/A"}{" "}
                    {selectedRecord.eosinophils_abs?.unit || ""}{" "}
                    {selectedRecord.eosinophils_abs?.reference_range &&
                      `(Range: ${selectedRecord.eosinophils_abs.reference_range})`}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Basophil:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.basophils_abs?.result || "N/A"}{" "}
                    {selectedRecord.basophils_abs?.unit || ""}{" "}
                    {selectedRecord.basophils_abs?.reference_range &&
                      `(Range: ${selectedRecord.basophils_abs.reference_range})`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CbcUser;
