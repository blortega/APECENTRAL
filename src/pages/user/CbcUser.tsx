import React, { useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/firebaseConfig";
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

const CbcUser: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<CBCRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CBCRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Load all records from Firestore
  const loadRecords = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "cbcRecords"));
      const loadedRecords: CBCRecord[] = [];

      querySnapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as CBCRecord);
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

  // Delete record
  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    try {
      await deleteDoc(doc(db, "cbcRecords", recordId));
      await loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Filter records based on search
  const filteredRecords = records.filter(
    (record) =>
      record.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className={styles.pageTitle}>CBC Records</h1>
          <p className={styles.pageDescription}>
            View Complete Blood Count (CBC) lab results.
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
                <p className={styles.recordsSubtitle}>View CBC lab results</p>
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
                  No CBC records available or adjust your search criteria.
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
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id!)}
                          className={styles.deleteButton}
                        >
                          Delete
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
                    (Result: {selectedRecord.rbc.result}) (Unit:{" "}
                    {selectedRecord.rbc.unit}) (Range:{" "}
                    {selectedRecord.rbc.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Hematocrit:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.hematocrit.result}) (Unit:{" "}
                    {selectedRecord.hematocrit.unit}) (Range:{" "}
                    {selectedRecord.hematocrit.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Hemoglobin:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.hemoglobin.result}) (Unit:{" "}
                    {selectedRecord.hemoglobin.unit}) (Range:{" "}
                    {selectedRecord.hemoglobin.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCV:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.mcv.result}) (Unit:{" "}
                    {selectedRecord.mcv.unit}) (Range:{" "}
                    {selectedRecord.mcv.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCH:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.mch.result}) (Unit:{" "}
                    {selectedRecord.mch.unit}) (Range:{" "}
                    {selectedRecord.mch.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCHC:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.mchc.result}) (Unit:{" "}
                    {selectedRecord.mchc.unit}) (Range:{" "}
                    {selectedRecord.mchc.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>RDW:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.rdw.result}) (Unit:{" "}
                    {selectedRecord.rdw.unit}) (Range:{" "}
                    {selectedRecord.rdw.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Platelet Count:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.platelets.result}) (Unit:{" "}
                    {selectedRecord.platelets.unit}) (Range:{" "}
                    {selectedRecord.platelets.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MPV:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.mpv.result}) (Unit:{" "}
                    {selectedRecord.mpv.unit}) (Range:{" "}
                    {selectedRecord.mpv.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>WBC Count:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.wbc.result}) (Unit:{" "}
                    {selectedRecord.wbc.unit}) (Range:{" "}
                    {selectedRecord.wbc.reference_range})
                  </span>
                </div>

                <h4 className={styles.sectionSubtitle}>
                  WBC Differential Count
                </h4>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Neutrophil:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.neutrophils_percent.result}) (Unit:{" "}
                    {selectedRecord.neutrophils_percent.unit}) (Range:{" "}
                    {selectedRecord.neutrophils_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Lymphocytes:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.lymphocytes_percent.result}) (Unit:{" "}
                    {selectedRecord.lymphocytes_percent.unit}) (Range:{" "}
                    {selectedRecord.lymphocytes_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Monocytes:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.monocytes_percent.result}) (Unit:{" "}
                    {selectedRecord.monocytes_percent.unit}) (Range:{" "}
                    {selectedRecord.monocytes_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Eosinophil:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.eosinophils_percent.result}) (Unit:{" "}
                    {selectedRecord.eosinophils_percent.unit}) (Range:{" "}
                    {selectedRecord.eosinophils_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Basophil:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.basophils_percent.result}) (Unit:{" "}
                    {selectedRecord.basophils_percent.unit}) (Range:{" "}
                    {selectedRecord.basophils_percent.reference_range})
                  </span>
                </div>

                <h4 className={styles.sectionSubtitle}>WBC Absolute Count</h4>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Neutrophil:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.neutrophils_abs?.result || "N/A"})
                    (Unit: {selectedRecord.neutrophils_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.neutrophils_abs?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Lymphocyte:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.lymphocytes_abs?.result || "N/A"})
                    (Unit: {selectedRecord.lymphocytes_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.lymphocytes_abs?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Monocyte:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.monocytes_abs?.result || "N/A"})
                    (Unit: {selectedRecord.monocytes_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.monocytes_abs?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Eosinophil:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.eosinophils_abs?.result || "N/A"})
                    (Unit: {selectedRecord.eosinophils_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.eosinophils_abs?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Basophil:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.basophils_abs?.result || "N/A"})
                    (Unit: {selectedRecord.basophils_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.basophils_abs?.reference_range || "N/A"})
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
