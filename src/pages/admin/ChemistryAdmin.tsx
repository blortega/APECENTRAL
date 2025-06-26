import React, { useState, useRef, useEffect } from "react";
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
import useGenerateActivity from "@/hooks/useGenerateActivity";

interface TestResult {
  test_name: string;
  result: string;
  unit: string;
  reference_range: string;
}

interface ChemRecord {
  id?: string;
  uniqueId: string;
  fileName: string;
  uploadDate: string;
  pdfUrl: string;
  name: string;
  mrn: string;
  gender: string;
  age: string;
  care_provider: string;
  location: string;
  dob: string;
  collection_datetime: string;
  result_validated: string;
  test_results: TestResult[];
  // Optional structured chemistry values
  fbs?: string;
  bua?: string;
  creatinine?: string;
  sgpt?: string;
  cholesterol?: string;
  hdl?: string;
  ldl?: string;
  triglycerides?: string;
}

const ChemistryAdmin: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<ChemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ChemRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize the activity hook
  const {
    generateActivity,
    isLoading: activityLoading,
    error: activityError,
  } = useGenerateActivity();

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Handle file upload with activity logging
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setLoading(true);
    setUploadProgress("Starting upload...");

    let uploadedCount = 0;
    let totalFiles = files.length;

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

      try {
        const res = await fetch("https://apecentral.onrender.com/upload-and-store?type=chem", {
          method: "POST",
          body: formData,
        });

        const result = await res.json();
        if (result.error) {
          console.error(`Error in ${file.name}:`, result.error);
          continue;
        }

        const data = result.data ?? result;
        const pdfUrl = result.pdfUrl ?? "";

        // Check for duplicates in Firestore
        const q = query(
          collection(db, "chemRecords"),
          where("uniqueId", "==", data.uniqueId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${data.name}`);
          continue;
        }

        // Save to Firestore
        await addDoc(collection(db, "chemRecords"), { ...data, pdfUrl });
        setUploadProgress(`Saved ${data.name}`);
        uploadedCount++;

        // Log individual upload activity
        try {
          await generateActivity(
            "chem_upload",
            `Uploaded Chemistry record for ${data.name} (${data.uniqueId})`
          );
        } catch (activityErr) {
          console.error("Failed to log upload activity:", activityErr);
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    await loadRecords();
    setUploadProgress("Upload finished.");
    setLoading(false);

    // Log bulk upload activity if multiple files were uploaded
    if (uploadedCount > 1) {
      try {
        await generateActivity(
          "bulk_import",
          `Bulk uploaded ${uploadedCount} Chemistry records from ${totalFiles} files`
        );
      } catch (activityErr) {
        console.error("Failed to log bulk upload activity:", activityErr);
      }
    }
  };

  // Load all records from Firestore
  const loadRecords = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "chemRecords"));
      const loadedRecords: ChemRecord[] = [];

      snapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as ChemRecord);
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

  // Delete record with activity logging
  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    // Find the record to get patient info for logging
    const recordToDelete = records.find((record) => record.id === recordId);

    try {
      await deleteDoc(doc(db, "chemRecords", recordId));
      await loadRecords();

      // Log delete activity
      try {
        const patientInfo = recordToDelete
          ? `${recordToDelete.name} (${recordToDelete.uniqueId})`
          : "Unknown patient";
        await generateActivity(
          "chem_delete",
          `Deleted Chemistry record for ${patientInfo}`
        );
      } catch (activityErr) {
        console.error("Failed to log delete activity:", activityErr);
      }
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Handle viewing record details
  const handleViewRecord = (record: ChemRecord) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  // Filter records based on search
  const filteredRecords = records.filter(
    (record) =>
      record.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load records on component mount
  useEffect(() => {
    loadRecords();
  }, []);

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Chemistry Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage laboratory chemistry test results for comprehensive
            patient care
          </p>
        </div>

        {/* Activity Status Indicator */}
        {activityLoading && (
          <div className={styles.activityStatus}>
            <p>Logging activity...</p>
          </div>
        )}
        {activityError && (
          <div className={styles.activityError}>
            <p>Activity logging error: {activityError}</p>
          </div>
        )}

        <main className={styles.mainContent}>
          {/* Upload Section */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Upload Chemistry PDFs</h2>
              <p className={styles.sectionDescription}>
                Select PDF files containing chemistry lab reports
              </p>
            </div>
            <div className={styles.uploadCard}>
              <div className={styles.uploadArea}>
                <div className={styles.uploadIcon}>🧪</div>
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
                  View and manage chemistry lab test results
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
                <div className={styles.noRecordsIcon}>🧪</div>
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
                        <h3 className={styles.patientName}>{record.name}</h3>
                        <p className={styles.uniqueId}>{record.uniqueId}</p>
                      </div>
                      <div className={styles.recordActions}>
                        <button
                          onClick={() => handleViewRecord(record)}
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
                        <span className={styles.recordLabel}>MRN:</span>
                        <span className={styles.recordValue}>{record.mrn}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Age:</span>
                        <span className={styles.recordValue}>{record.age}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Gender:</span>
                        <span className={styles.recordValue}>{record.gender}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Collection Date:</span>
                        <span className={styles.recordValue}>
                          {record.collection_datetime}
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
              <h3 className={styles.modalTitle}>Chemistry Report Details</h3>
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
                    <span className={styles.infoValue}>{selectedRecord.name}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>MRN:</span>
                    <span className={styles.infoValue}>{selectedRecord.mrn}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date of Birth:</span>
                    <span className={styles.infoValue}>{selectedRecord.dob}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Age:</span>
                    <span className={styles.infoValue}>{selectedRecord.age}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Gender:</span>
                    <span className={styles.infoValue}>{selectedRecord.gender}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Unique ID:</span>
                    <span className={styles.infoValue}>{selectedRecord.uniqueId}</span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Laboratory Details</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Care Provider:</span>
                    <span className={styles.infoValue}>{selectedRecord.care_provider}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Location:</span>
                    <span className={styles.infoValue}>{selectedRecord.location}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Collection Date/Time:</span>
                    <span className={styles.infoValue}>{selectedRecord.collection_datetime}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Result Validated:</span>
                    <span className={styles.infoValue}>{selectedRecord.result_validated}</span>
                  </div>
                </div>
              </div>

              {/* Test Results Table */}
              <div className={styles.testResultsSection}>
                <h4 className={styles.sectionSubtitle}>Test Results</h4>
                {selectedRecord.test_results && selectedRecord.test_results.length > 0 ? (
                  <div className={styles.testResultsGrid}>
                    {selectedRecord.test_results.map((result, index) => (
                      <div key={index} className={styles.testResultCard}>
                        <div className={styles.testResultHeader}>
                          <h5 className={styles.testResultName}>{result.test_name}</h5>
                        </div>
                        <div className={styles.testResultBody}>
                          <div className={styles.testResultItem}>
                            <span className={styles.testResultLabel}>Result:</span>
                            <span className={styles.testResultValue}>{result.result}</span>
                          </div>
                          <div className={styles.testResultItem}>
                            <span className={styles.testResultLabel}>Unit:</span>
                            <span className={styles.testResultValue}>{result.unit}</span>
                          </div>
                          <div className={styles.testResultItem}>
                            <span className={styles.testResultLabel}>Reference:</span>
                            <span className={styles.testResultValue}>{result.reference_range}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noTestResults}>No test results available</p>
                )}
              </div>

              {/* Key Chemistry Values (if available) */}
              {(selectedRecord.fbs || selectedRecord.cholesterol || selectedRecord.creatinine) && (
                <div className={styles.keyValuesSection}>
                  <h4 className={styles.sectionSubtitle}>Key Chemistry Values</h4>
                  <div className={styles.keyValuesGrid}>
                    {selectedRecord.fbs && (
                      <div className={styles.keyValue}>
                        <span className={styles.keyLabel}>FBS:</span>
                        <span className={styles.keyResult}>{selectedRecord.fbs}</span>
                      </div>
                    )}
                    {selectedRecord.cholesterol && (
                      <div className={styles.keyValue}>
                        <span className={styles.keyLabel}>Cholesterol:</span>
                        <span className={styles.keyResult}>{selectedRecord.cholesterol}</span>
                      </div>
                    )}
                    {selectedRecord.creatinine && (
                      <div className={styles.keyValue}>
                        <span className={styles.keyLabel}>Creatinine:</span>
                        <span className={styles.keyResult}>{selectedRecord.creatinine}</span>
                      </div>
                    )}
                    {selectedRecord.sgpt && (
                      <div className={styles.keyValue}>
                        <span className={styles.keyLabel}>SGPT/ALT:</span>
                        <span className={styles.keyResult}>{selectedRecord.sgpt}</span>
                      </div>
                    )}
                    {selectedRecord.hdl && (
                      <div className={styles.keyValue}>
                        <span className={styles.keyLabel}>HDL:</span>
                        <span className={styles.keyResult}>{selectedRecord.hdl}</span>
                      </div>
                    )}
                    {selectedRecord.ldl && (
                      <div className={styles.keyValue}>
                        <span className={styles.keyLabel}>LDL:</span>
                        <span className={styles.keyResult}>{selectedRecord.ldl}</span>
                      </div>
                    )}
                    {selectedRecord.triglycerides && (
                      <div className={styles.keyValue}>
                        <span className={styles.keyLabel}>Triglycerides:</span>
                        <span className={styles.keyResult}>{selectedRecord.triglycerides}</span>
                      </div>
                    )}
                    {selectedRecord.bua && (
                      <div className={styles.keyValue}>
                        <span className={styles.keyLabel}>BUA/Uric Acid:</span>
                        <span className={styles.keyResult}>{selectedRecord.bua}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PDF Section */}
              {selectedRecord?.pdfUrl && (
                <div className={styles.pdfSection}>
                  <h4 className={styles.sectionSubtitle}>📄 PDF Report</h4>
                  <iframe
                    src={selectedRecord.pdfUrl}
                    width="100%"
                    height="500px"
                    style={{
                      border: "1px solid #ccc",
                      marginTop: "10px",
                      borderRadius: "8px",
                    }}
                    title="PDF Preview"
                  />
                  <div className={styles.pdfActions}>
                    <a
                      href={selectedRecord.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.viewPdfButton}
                    >
                      🔗 View in New Tab
                    </a>
                    <a
                      href={selectedRecord.pdfUrl}
                      download={selectedRecord.fileName}
                      className={styles.downloadPdfButton}
                    >
                      ⬇️ Download PDF
                    </a>
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

export default ChemistryAdmin;