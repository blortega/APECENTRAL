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

interface LabValue {
  result: string;
  unit: string;
  reference_range: string;
  flag: string;
}

interface UrinalysisRecord {
  id?: string;
  uniqueId: string;
  patientName: string;
  mrn: string;
  gender: string;
  age: string;
  dob: string;
  collectionDateTime: string;
  resultValidated: string;
  orderNumber: string;
  location: string;

  color: LabValue;
  clarity: LabValue;
  glucose: LabValue;
  bilirubin: LabValue;
  ketones: LabValue;
  specific_gravity: LabValue;
  blood: LabValue;
  ph: LabValue;
  protein: LabValue;
  urobilinogen: LabValue;
  nitrite: LabValue;
  leukocyte_esterase: LabValue;
  rbc: LabValue;
  wbc: LabValue;
  epithelial_cells: LabValue;
  bacteria: LabValue;
  hyaline_cast: LabValue;
  remarks: LabValue;

  fileName: string;
  uploadDate: string;
}

const UrinalysisAdmin: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<UrinalysisRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<UrinalysisRecord | null>(
    null
  );
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize activity logging hook
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

    let successfulUploads = 0;
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
        const res = await fetch("http://localhost:8000/extract-urinalysis", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        console.log("Parsed Data from backend:", data);

        if (data.error) {
          console.error(`Error in ${file.name}:`, data.error);
          continue;
        }

        // Check for duplicates in Firestore
        const q = query(
          collection(db, "urinalysisRecords"),
          where("uniqueId", "==", data.uniqueId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${data.patientName}`);
          continue;
        }

        // Save to Firestore
        await addDoc(collection(db, "urinalysisRecords"), data);
        setUploadProgress(`Saved ${data.patientName}`);
        successfulUploads++;
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    // Log activity for successful uploads
    if (successfulUploads > 0) {
      try {
        await generateActivity(
          "urinalysis_add",
          `Successfully uploaded ${successfulUploads} urinalysis record${
            successfulUploads > 1 ? "s" : ""
          } from ${totalFiles} file${totalFiles > 1 ? "s" : ""}`
        );
      } catch (err) {
        console.error("Failed to log upload activity:", err);
      }
    }

    await loadRecords();
    setUploadProgress("Upload finished.");
    setLoading(false);
  };

  // Load all records from Firestore with activity logging
  const loadRecords = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "urinalysisRecords"));
      const loadedRecords: UrinalysisRecord[] = [];

      querySnapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as UrinalysisRecord);
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

    // Find the record to get patient name for logging
    const recordToDelete = records.find((record) => record.id === recordId);
    const patientName = recordToDelete?.patientName || "Unknown Patient";

    try {
      await deleteDoc(doc(db, "urinalysisRecords", recordId));

      // Log delete activity
      try {
        await generateActivity(
          "urinalysis_delete",
          `Deleted urinalysis record for patient: ${patientName}`
        );
      } catch (err) {
        console.error("Failed to log delete activity:", err);
      }

      await loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Handle viewing record with activity logging
  const handleViewRecord = async (record: UrinalysisRecord) => {
    setSelectedRecord(record);
    setShowModal(true);

    // Log view activity
    try {
      await generateActivity(
        "records_search",
        `Viewed urinalysis record for patient: ${record.patientName}`
      );
    } catch (err) {
      console.error("Failed to log view activity:", err);
    }
  };

  // Handle search with activity logging
  const handleSearch = async (searchValue: string) => {
    setSearchTerm(searchValue);

    // Only log if there's actual search content
    if (searchValue.trim().length > 2) {
      try {
        await generateActivity(
          "records_search",
          `Searched urinalysis records with term: "${searchValue.trim()}"`
        );
      } catch (err) {
        console.error("Failed to log search activity:", err);
      }
    }
  };

  // Handle refresh with activity logging
  const handleRefresh = async () => {
    try {
      await generateActivity(
        "records_filter",
        "Refreshed urinalysis records list"
      );
    } catch (err) {
      console.error("Failed to log refresh activity:", err);
    }

    await loadRecords();
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
          <h1 className={styles.pageTitle}>Urinalysis Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage Urinalysis lab results.
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
              <h2 className={styles.sectionTitle}>Upload Urinalysis PDFs</h2>
              <p className={styles.sectionDescription}>
                Select PDF files containing Urinalysis Results
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
                  View and manage Urinalysis results
                </p>
              </div>
              <button
                onClick={handleRefresh}
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
                          disabled={activityLoading}
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
              <h3 className={styles.modalTitle}>Urinalysis Result Details</h3>
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
                <h4 className={styles.sectionSubtitle}>Urinalysis, Routine</h4>
                <h4 className={styles.sectionSubtitle}>PHYSICAL EXAMINATION</h4>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Color:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.color?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.color?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.color?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Clarity:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.clarity?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.clarity?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.clarity?.reference_range || "N/A"})
                  </span>
                </div>

                <h4 className={styles.sectionSubtitle}>CHEMICAL ANALYSIS</h4>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Glucose:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.glucose?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.glucose?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.glucose?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Bilirubin:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.bilirubin?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.bilirubin?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.bilirubin?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Ketones:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.ketones?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.ketones?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.ketones?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Specific Gravity:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.specific_gravity?.result || "N/A"})
                    (Unit: {selectedRecord.specific_gravity?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.specific_gravity?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Blood:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.blood?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.blood?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.blood?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>PH:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.ph?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.ph?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.ph?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Protein:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.protein?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.protein?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.protein?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Urobilinogen:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.urobilinogen?.result || "N/A"})
                    (Unit: {selectedRecord.urobilinogen?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.urobilinogen?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Nitrite:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.nitrite?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.nitrite?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.nitrite?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Leukocyte Esterase:</span>
                  <span className={styles.infoValue}>
                    (Result:{" "}
                    {selectedRecord.leukocyte_esterase?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.leukocyte_esterase?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.leukocyte_esterase?.reference_range ||
                      "N/A"}
                    )
                  </span>
                </div>

                <h4 className={styles.sectionSubtitle}>URINE FLOW CYTOMETRY</h4>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>RBC:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.rbc?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.rbc?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.rbc?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>WBC:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.wbc?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.wbc?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.wbc?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Epithelial Cells:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.epithelial_cells?.result || "N/A"})
                    (Unit: {selectedRecord.epithelial_cells?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.epithelial_cells?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Bacteria:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.bacteria?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.bacteria?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.bacteria?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Hyaline Cast:</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.hyaline_cast?.result || "N/A"})
                    (Unit: {selectedRecord.hyaline_cast?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.hyaline_cast?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Remarks</span>
                  <span className={styles.infoValue}>
                    (Result: {selectedRecord.remarks?.result || "N/A"}) (Unit:{" "}
                    {selectedRecord.remarks?.unit || "N/A"}) (Range:{" "}
                    {selectedRecord.remarks?.reference_range || "N/A"})
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

export default UrinalysisAdmin;
