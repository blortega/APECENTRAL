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
import useGenerateActivity from "@/hooks/useGenerateActivity"; // Import the hook

interface EcgRecord {
  id?: string;
  uniqueId: string;
  pidNo: string;
  date: string;
  patientName: string;
  referringPhysician: string;
  hr: string;
  bp: string;
  age: string;
  sex: string;
  birthDate: string;
  qrs: string;
  qtQtc: string;
  pr: string;
  pWave: string;
  rrPp: string;
  pqrstAxis: string;
  interpretation: string;
  fileName: string;
  uploadDate: string;
  pdfUrl: string;
}


const EcgAdmin: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<EcgRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<EcgRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize the activity logging hook
  const {
    generateActivity,
    isLoading: activityLoading,
    error: activityError,
  } = useGenerateActivity();

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Handle file upload with activity logging
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/upload-and-store?type=ecg`, {
          method: "POST",
          body: formData,
        });

        const {data, pdfUrl} = await res.json();

        console.log("Parsed Data from backend:", data);

        if (data.error) {
          console.error(`Error in ${file.name}:`, data.error);
          continue;
        }

        // Check for duplicates in Firestore
        if (!data.uniqueId) {
          console.error(
            "Upload error: uniqueId is missing from backend response."
          );
          continue;
        }
        const q = query(
          collection(db, "ecgRecords"),
          where("uniqueId", "==", data.uniqueId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${data.patient_name}`);
          continue;
        }

        // Save to Firestore
        await addDoc(collection(db, "ecgRecords"), 
        {...data, pdfUrl});
        setUploadProgress(`Saved ${data.patient_name}`);
        uploadedCount++;

        // Log individual upload activity with proper ECG terminology
        try {
          await generateActivity(
            "ecg_upload",
            `Uploaded ECG record for ${data.patient_name} (${data.uniqueId})`
          );
        } catch (activityErr) {
          console.error("Failed to log upload activity:", activityErr);
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    // Log summary if multiple files processed
    try {
      if (uploadedCount > 1) {
        await generateActivity(
          "bulk_import",
          `Bulk uploaded ${uploadedCount} ECG records from ${totalFiles} file(s)`
        );
      }
    } catch (err) {
      console.error("Failed to log bulk upload summary:", err);
    }

    await loadRecords();
    setUploadProgress("Upload finished.");
    setLoading(false);
  };

  // Load all records from Firestore with activity logging
  const loadRecords = async (logActivity = false) => {
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

      // Log activity only when manually refreshing (not on component mount)
      if (logActivity) {
        try {
          await generateActivity(
            "records_search",
            "Refreshed ECG records list"
          );
        } catch (err) {
          console.error("Failed to log refresh activity:", err);
        }
      }
    } catch (error) {
      console.error("Error loading records:", error);
    } finally {
      setLoading(false);
    }
  };

  // Delete record with activity logging
  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    // Find the record to get patient details for logging
    const recordToDelete = records.find((r) => r.id === recordId);
    const patientName = recordToDelete?.patientName || "Unknown Patient";
    const uniqueId = recordToDelete?.uniqueId || "";

    try {
      await deleteDoc(doc(db, "ecgRecords", recordId));

      // Log the delete activity with proper ECG terminology
      try {
        await generateActivity(
          "ecg_delete",
          `Deleted ECG record for ${patientName} (${uniqueId})`
        );
      } catch (err) {
        console.error("Failed to log delete activity:", err);
      }

      await loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Handle search with activity logging
  const handleSearch = async (searchValue: string) => {
    setSearchTerm(searchValue);

    // Log search activity only if there's a meaningful search term
    if (searchValue.trim().length > 2) {
      try {
        await generateActivity(
          "records_search",
          `Searched ECG records for: "${searchValue.trim()}"`
        );
      } catch (err) {
        console.error("Failed to log search activity:", err);
      }
    } else if (searchValue.trim().length === 0) {
      // Log when clearing search
      try {
        await generateActivity(
          "records_filter",
          "Cleared ECG records search filter"
        );
      } catch (err) {
        console.error("Failed to log filter clear activity:", err);
      }
    }
  };

  // Handle record view (no activity logging needed)
  const handleViewRecord = (record: EcgRecord) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  // Filter records based on search
  const filteredRecords = records.filter(
    (record) =>
      record.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.pidNo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load records on component mount (without logging)
  React.useEffect(() => {
    loadRecords(false);
  }, []);

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>ECG Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage ECG records for comprehensive patient care
          </p>
          {/* Show activity logging status */}
          {activityLoading && (
            <div className={styles.activityStatus}>
              <small>Logging activity...</small>
            </div>
          )}
          {activityError && (
            <div className={styles.activityError}>
              <small>Activity logging error: {activityError}</small>
            </div>
          )}
        </div>

        <main className={styles.mainContent}>
          {/* Upload Section */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Upload ECG PDFs</h2>
              <p className={styles.sectionDescription}>
                Select PDF files containing ECG reports
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
                  disabled={loading || activityLoading}
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
                placeholder="Search by patient name, ID, or company..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
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
                  View and manage ECG results
                </p>
              </div>
              <button
                onClick={() => loadRecords(true)}
                className={styles.refreshButton}
                disabled={loading || activityLoading}
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
                          onClick={() => handleViewRecord(record)}
                          className={styles.viewButton}
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id!)}
                          className={styles.deleteButton}
                          disabled={activityLoading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className={styles.recordDetails}>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>PID NO:</span>
                        <span className={styles.recordValue}>
                          {record.pidNo}
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
                      {selectedRecord.pidNo}
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
                    {selectedRecord.patientName}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Date of Birth:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.birthDate}
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
                  {selectedRecord.qtQtc}
                </span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>PR:</span>
                <span className={styles.infoValue}>{selectedRecord.pr}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>P:</span>
                <span className={styles.infoValue}>{selectedRecord.pWave}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>RR/PP:</span>
                <span className={styles.infoValue}>{selectedRecord.rrPp}</span>
              </div>

              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>P/QRS/T:</span>
                <span className={styles.infoValue}>{selectedRecord.pqrstAxis}</span>
              </div>
            </div>

            <div className={styles.interpretationSection}>
              <h4 className={styles.sectionSubtitle}>Medical Interpretation</h4>
              <div className={styles.interpretationText}>
                {selectedRecord.interpretation}
              </div>
            </div>
            {selectedRecord?.pdfUrl && (() => {
                  const baseUrl = import.meta.env.VITE_BACKEND_URL;
                  const isFullUrl = selectedRecord.pdfUrl.startsWith("http");
                  const pdfPath = isFullUrl
                    ? selectedRecord.pdfUrl
                    : `${baseUrl}/view-pdf/${selectedRecord.pdfUrl}`;

  return (
    <div className={styles.pdfSection}>
      <h4 className={styles.sectionSubtitle}>📄 PDF Report</h4>

      <iframe
        src={pdfPath}
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
          href={pdfPath}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.viewPdfButton}
        >
          🔗 View in New Tab
        </a>

        <a
          href={pdfPath}
          download={selectedRecord.fileName}
          className={styles.downloadPdfButton}
        >
          ⬇️ Download PDF
        </a>
      </div>
    </div>
  );
})()}
          </div>
        </div>
      )}
    </div>
  );
};

export default EcgAdmin;
