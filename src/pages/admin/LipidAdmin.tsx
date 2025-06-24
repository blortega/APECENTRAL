import React, { useState, useRef } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";
import styles from "@/styles/XRay.module.css";
import Sidebar from "@/components/Sidebar";

// Fixed interface to match backend response
interface LipidRecord {
  id?: string;
  uniqueId: string;
  patientName: string;
  mrn: string;
  gender: string;
  age: string;
  careprovider: string;
  location: string;
  dateOfBirth: string;
  collectionDateTime: string;
  resultValidated: string;
  fileName: string;
  uploadDate: string;
  testResults: {
    [key: string]: {
      result: string;
      unit: string;
      reference_range: string;
      flag?: string;
    };
  };
}

const LipidAdmin: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<LipidRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<LipidRecord | null>(
    null
  );
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    setLoading(true);
    setUploadProgress("Starting upload...");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.type !== "application/pdf") {
          alert(`File ${file.name} is not a PDF file`);
          continue;
        }

        setUploadProgress(
          `Processing ${file.name}... (${i + 1}/${files.length})`
        );

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("http://localhost:8000/extract-lipid", {
          method: "POST",
          body: formData,
        });

        const result = await res.json();

        console.log("Backend response:", result);

        if (!result.success) {
          console.error(`Error processing ${file.name}:`, result.error);
          setUploadProgress(`Error processing ${file.name}: ${result.error}`);
          continue;
        }

        if (!result.data?.uniqueId) {
          console.error(`Missing uniqueId in response for ${file.name}`);
          setUploadProgress(`Missing uniqueId for ${file.name}`);
          continue;
        }

        // Check for duplicates
        const q = query(
          collection(db, "lipidRecords"),
          where("uniqueId", "==", result.data.uniqueId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${result.data.patientName}`);
          setUploadProgress(`Duplicate record for ${result.data.patientName}`);
          continue;
        }

        // Save to Firestore
        await addDoc(collection(db, "lipidRecords"), result.data);
        setUploadProgress(`Saved ${result.data.patientName}`);
      }

      setUploadProgress("Upload completed!");
    } catch (err) {
      console.error("Upload error:", err);
      setUploadProgress(`Upload failed: ${err}`);
    } finally {
      await loadRecords();
      setTimeout(() => setUploadProgress(""), 3000); // Clear message after 3 seconds
      setLoading(false);
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "lipidRecords"));
      const loadedRecords: LipidRecord[] = [];

      querySnapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as LipidRecord);
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

  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, "lipidRecords", recordId));
      await loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  const filteredRecords = records.filter(
    (record) =>
      record.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  React.useEffect(() => {
    loadRecords();
  }, []);

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Lipid Profile Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage lipid profile examination records
          </p>
        </div>

        <main className={styles.mainContent}>
          {/* Upload Section */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Upload Lipid Profile PDFs</h2>
              <p className={styles.sectionDescription}>
                Select PDF files containing lipid profile reports
              </p>
            </div>
            <div className={styles.uploadCard}>
              <div className={styles.uploadArea}>
                <div className={styles.uploadIcon}>📄</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className={styles.fileInput}
                  disabled={loading}
                />
                <div className={styles.uploadText}>
                  <p className={styles.uploadMainText}>
                    Choose PDF files or drag and drop
                  </p>
                  <p className={styles.uploadSubText}>
                    Multiple PDF files supported
                  </p>
                </div>
              </div>
              {uploadProgress && (
                <div className={styles.progressMessage}>{uploadProgress}</div>
              )}
            </div>
          </section>

          {/* Search Section */}
          <section className={styles.searchSection}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search by patient name, ID, or MRN..."
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
                  View and manage lipid profile results
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
                  Upload some PDF files to get started or adjust your search
                  criteria.
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
                        <span className={styles.recordLabel}>MRN:</span>
                        <span className={styles.recordValue}>{record.mrn}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>
                          Collection Date:
                        </span>
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
              <h3 className={styles.modalTitle}>
                Lipid Profile Report Details
              </h3>
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
                    <span className={styles.infoLabel}>MRN:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.mrn}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date of Birth:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.dateOfBirth}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Careprovider:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.careprovider}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Location:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.location}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>
                  Collection & Validation
                </h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>
                      Collection Date/Time:
                    </span>
                    <span className={styles.infoValue}>
                      {selectedRecord.collectionDateTime}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Result Validated:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.resultValidated}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.resultsSection}>
                <h4 className={styles.sectionSubtitle}>Test Results</h4>
                <div className={styles.resultsTable}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f5f5f5" }}>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Test
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Result
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Unit
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Reference Range
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Flag
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedRecord.testResults).map(
                        ([test, data]) => (
                          <tr key={test}>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                              }}
                            >
                              {test}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                                fontWeight: "bold",
                              }}
                            >
                              {data.result}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                              }}
                            >
                              {data.unit}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                              }}
                            >
                              {data.reference_range}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                                color:
                                  data.flag === "H"
                                    ? "red"
                                    : data.flag === "L"
                                    ? "blue"
                                    : "black",
                                fontWeight: data.flag ? "bold" : "normal",
                              }}
                            >
                              {data.flag || "-"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LipidAdmin;
