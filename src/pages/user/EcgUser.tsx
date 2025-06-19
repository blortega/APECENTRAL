import React, { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebaseConfig";
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

const EcgUser: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<EcgRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<EcgRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Load all records from Firestore
  const loadRecords = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "ecgRecords"));
      const loadedRecords: EcgRecord[] = [];

      querySnapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as EcgRecord);
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
      setLoading(false);
    }
  };

  // Filter records based on search
  const filteredRecords = records.filter(
    (record) =>
      record.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.pid_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load records on component mount
  React.useEffect(() => {
    loadRecords();
  }, []);

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>ECG Records</h1>
          <p className={styles.pageDescription}>
            View your ECG records and medical reports
          </p>
        </div>

        <main className={styles.mainContent}>
          {/* Search Section */}
          <section className={styles.searchSection}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search by patient name, ID, or company..."
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
                  Patient Records ({filteredRecords.length})
                </h2>
                <p className={styles.recordsSubtitle}>
                  View ECG results and reports
                </p>
              </div>
              <button
                onClick={loadRecords}
                className={styles.refreshButton}
                disabled={loading}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {filteredRecords.length === 0 ? (
              <div className={styles.noRecords}>
                <div className={styles.noRecordsIcon}>📋</div>
                <h3 className={styles.noRecordsTitle}>No Records Found</h3>
                <p className={styles.noRecordsText}>
                  No ECG records available or adjust your search criteria.
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
                          View
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
                <div className={styles.examSection}>
                  <h4 className={styles.sectionSubtitle}>
                    Examination Details
                  </h4>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>PID NO:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.pid_no}
                    </span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Report Date:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.date}
                    </span>
                  </div>
                </div>
              </div>
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
                  <span className={styles.infoValue}>{selectedRecord.age}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Gender:</span>
                  <span className={styles.infoValue}>{selectedRecord.sex}</span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Unique ID:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.uniqueId}
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>HR:</span>
                  <span className={styles.infoValue}>{selectedRecord.hr}</span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>BP:</span>
                  <span className={styles.infoValue}>{selectedRecord.bp}</span>
                </div>
              </div>

              <h4 className={styles.sectionSubtitle}>Diagram Report</h4>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>QRS:</span>
                <span className={styles.infoValue}>{selectedRecord.qrs}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>QT/QTcBaZ:</span>
                <span className={styles.infoValue}>
                  {selectedRecord.qt_qtc}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>PR:</span>
                <span className={styles.infoValue}>{selectedRecord.pr}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>P:</span>
                <span className={styles.infoValue}>{selectedRecord.p}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>RR/PP:</span>
                <span className={styles.infoValue}>{selectedRecord.rr_pp}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>P/QRS/T:</span>
                <span className={styles.infoValue}>{selectedRecord.pqrst}</span>
              </div>
            </div>

            <div className={styles.interpretationSection}>
              <h4 className={styles.sectionSubtitle}>Medical Interpretation</h4>
              <div className={styles.interpretationText}>
                {selectedRecord.interpretation}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EcgUser;
