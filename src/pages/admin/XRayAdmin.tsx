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
import useGenerateActivity from "@/hooks/useGenerateActivity";

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
  pdfUrl: string;
}

const XRayAdmin: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<XRayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<XRayRecord | null>(null);
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
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/upload-and-store?type=xray`, {
          method: "POST",
          body: formData,
        });

        const {data, pdfUrl} = await res.json();

        if (data.error) {
          console.error(`Error in ${file.name}:`, data.error);
          continue;
        }

        // Check for duplicates in Firestore
        const q = query(
          collection(db, "xrayRecords"),
          where("uniqueId", "==", data.uniqueId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${data.patientName}`);
          continue;
        }

        // Save to Firestore
        await addDoc(collection(db, "xrayRecords"), 
        { ...data, pdfUrl});
        setUploadProgress(`Saved ${data.patientName}`);
        uploadedCount++;

        // Log individual upload activity
        try {
          await generateActivity(
            "xray_upload",
            `Uploaded X-Ray record for ${data.patientName} (${data.uniqueId})`
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
          `Bulk uploaded ${uploadedCount} X-Ray records from ${totalFiles} files`
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
      const querySnapshot = await getDocs(collection(db, "xrayRecords"));
      const loadedRecords: XRayRecord[] = [];

      querySnapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as XRayRecord);
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
      await deleteDoc(doc(db, "xrayRecords", recordId));
      await loadRecords();

      // Log delete activity
      try {
        const patientInfo = recordToDelete
          ? `${recordToDelete.patientName} (${recordToDelete.uniqueId})`
          : "Unknown patient";
        await generateActivity(
          "xray_delete",
          `Deleted X-Ray record for ${patientInfo}`
        );
      } catch (activityErr) {
        console.error("Failed to log delete activity:", activityErr);
      }
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Handle viewing record details
  const handleViewRecord = (record: XRayRecord) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  // Filter records based on search
  const filteredRecords = records.filter(
    (record) =>
      record.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.company?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className={styles.pageTitle}>X-Ray Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage X-ray examination records for comprehensive
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
              <h2 className={styles.sectionTitle}>Upload X-Ray PDFs</h2>
              <p className={styles.sectionDescription}>
                Select PDF files containing X-ray reports
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
                  View and manage X-ray examination results
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

              {/* Added Impression Section */}
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
              {selectedRecord?.pdfUrl && (
  <div className={styles.pdfSection}>
    <h4 className={styles.sectionSubtitle}>📄 PDF Report</h4>

    <iframe
      src={`${import.meta.env.VITE_BACKEND_URL}/view-pdf/${selectedRecord.pdfUrl}`}
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
        href={`${import.meta.env.VITE_BACKEND_URL}/view-pdf/${selectedRecord.pdfUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.viewPdfButton}
      >
        🔗 View in New Tab
      </a>

      <a
        href={`${import.meta.env.VITE_BACKEND_URL}/view-pdf/${selectedRecord.pdfUrl}`}
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

export default XRayAdmin;
