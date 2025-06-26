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

interface CBCValue {
  result: string;
  unit: string;
  reference_range: string;
  flag: string;
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
  pdfUrl: string,
}

const CbcAdmin: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<CBCRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CBCRecord | null>(null);
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
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/upload-and-store?type=cbc`, {
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
          collection(db, "cbcRecords"),
          where("uniqueId", "==", data.uniqueId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${data.patientName}`);
          continue;
        }

        // Save to Firestore
        await addDoc(collection(db, "cbcRecords"), 
        {...data, pdfUrl});
        setUploadProgress(`Saved ${data.patientName}`);
        uploadedCount++;

        // Log individual CBC add activity
        try {
          await generateActivity(
            "cbc_add",
            `Added CBC record for ${data.patientName} (${data.uniqueId})`
          );
        } catch (activityErr) {
          console.error("Failed to log CBC add activity:", activityErr);
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    await loadRecords();
    setUploadProgress("Upload finished.");
    setLoading(false);

    // Log bulk import activity if multiple files were uploaded
    if (uploadedCount > 1) {
      try {
        await generateActivity(
          "bulk_import",
          `Bulk uploaded ${uploadedCount} CBC records from ${totalFiles} files`
        );
      } catch (activityErr) {
        console.error("Failed to log bulk import activity:", activityErr);
      }
    }
  };

  // Load all records from Firestore with activity logging
  const loadRecords = async (logActivity = false) => {
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

      // Log records search activity if explicitly requested (manual refresh)
      if (logActivity) {
        try {
          await generateActivity(
            "records_search",
            `Refreshed CBC records list (${loadedRecords.length} records found)`
          );
        } catch (activityErr) {
          console.error("Failed to log records search activity:", activityErr);
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

    // Find the record to get patient info for logging
    const recordToDelete = records.find((record) => record.id === recordId);

    try {
      await deleteDoc(doc(db, "cbcRecords", recordId));
      await loadRecords();

      // Log delete activity
      try {
        const patientInfo = recordToDelete
          ? `${recordToDelete.patientName} (${recordToDelete.uniqueId})`
          : "Unknown patient";
        await generateActivity(
          "cbc_delete",
          `Deleted CBC record for ${patientInfo}`
        );
      } catch (activityErr) {
        console.error("Failed to log delete activity:", activityErr);
      }
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Handle search with activity logging
  const handleSearch = async (searchValue: string) => {
    setSearchTerm(searchValue);

    // Log search activity if search term is meaningful (3+ characters)
    if (searchValue.length >= 3) {
      try {
        await generateActivity(
          "records_search",
          `Searched CBC records for: "${searchValue}"`
        );
      } catch (activityErr) {
        console.error("Failed to log search activity:", activityErr);
      }
    }
  };

  // Handle export functionality (you can implement this based on your needs)
  const handleExportData = async () => {
    try {
      // Add your export logic here
      console.log("Exporting CBC data...");

      // Log export activity
      await generateActivity(
        "cbc_export",
        `Exported CBC data (${filteredRecords.length} records)`
      );
    } catch (activityErr) {
      console.error("Failed to log export activity:", activityErr);
    }
  };

  // Filter records based on search
  const filteredRecords = records.filter(
    (record) =>
      record.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className={styles.pageTitle}>CBC Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage Complete Blood Count (CBC) lab results.
          </p>
        </div>

        <main className={styles.mainContent}>
          {/* Upload Section */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Upload CBC PDFs</h2>
              <p className={styles.sectionDescription}>
                Select PDF files containing CBC Results
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
              {activityLoading && (
                <div className={styles.progressMessage}>
                  Logging activity...
                </div>
              )}
              {activityError && (
                <div className={styles.errorMessage}>
                  Activity logging error: {activityError}
                </div>
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
                  View and manage CBC lab results
                </p>
              </div>
              <div className={styles.recordsActions}>
                <button
                  onClick={() => loadRecords(true)}
                  className={styles.refreshButton}
                  disabled={loading || activityLoading}
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
                <button
                  onClick={handleExportData}
                  className={styles.exportButton}
                  disabled={
                    loading || activityLoading || filteredRecords.length === 0
                  }
                >
                  Export Data
                </button>
              </div>
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
                        <p className={styles.mrn}>MRN: {record.mrn}</p>
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
                          disabled={activityLoading}
                        >
                          {activityLoading ? "..." : "Delete"}
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
                    <span className={styles.infoLabel}>Collection Date:</span>
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
                    {" "}
                    {selectedRecord.rbc.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.rbc.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.rbc.result}) (Unit:{" "}
                    {selectedRecord.rbc.unit}) (Range:{" "}
                    {selectedRecord.rbc.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Hematocrit:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.hematocrit.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.hematocrit.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.hematocrit.result}) (Unit:{" "}
                    {selectedRecord.hematocrit.unit}) (Range:{" "}
                    {selectedRecord.hematocrit.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Hemoglobin:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.hemoglobin.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.hemoglobin.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.hemoglobin.result}) (Unit:{" "}
                    {selectedRecord.hemoglobin.unit}) (Range:{" "}
                    {selectedRecord.hemoglobin.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCV:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.mcv.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.mcv.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.mcv.result}) (Unit:{" "}
                    {selectedRecord.mcv.unit}) (Range:{" "}
                    {selectedRecord.mcv.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCH:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.mch.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.mch.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.mch.result}) (Unit:{" "}
                    {selectedRecord.mch.unit}) (Range:{" "}
                    {selectedRecord.mch.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MCHC:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.mchc.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.mchc.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.mchc.result}) (Unit:{" "}
                    {selectedRecord.mchc.unit}) (Range:{" "}
                    {selectedRecord.mchc.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>RDW:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.rdw.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.rdw.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.rdw.result}) (Unit:{" "}
                    {selectedRecord.rdw.unit}) (Range:{" "}
                    {selectedRecord.rdw.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Platelet Count:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.platelets.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.platelets.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.platelets.result}) (Unit:{" "}
                    {selectedRecord.platelets.unit}) (Range:{" "}
                    {selectedRecord.platelets.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>MPV:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.mpv.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.mpv.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.mpv.result}) (Unit:{" "}
                    {selectedRecord.mpv.unit}) (Range:{" "}
                    {selectedRecord.mpv.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>WBC Count:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.wbc.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.wbc.flag}){" "}
                      </span>
                    )}
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
                    {" "}
                    {selectedRecord.neutrophils_percent.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.neutrophils_percent.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.neutrophils_percent.result}) (Unit:{" "}
                    {selectedRecord.neutrophils_percent.unit}) (Range:{" "}
                    {selectedRecord.neutrophils_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Lymphocytes:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.lymphocytes_percent.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.lymphocytes_percent.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.lymphocytes_percent.result}) (Unit:{" "}
                    {selectedRecord.lymphocytes_percent.unit}) (Range:{" "}
                    {selectedRecord.lymphocytes_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Monocytes:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.monocytes_percent.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.monocytes_percent.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.monocytes_percent.result}) (Unit:{" "}
                    {selectedRecord.monocytes_percent.unit}) (Range:{" "}
                    {selectedRecord.monocytes_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Eosinophil:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.eosinophils_percent.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.eosinophils_percent.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.eosinophils_percent.result}) (Unit:{" "}
                    {selectedRecord.eosinophils_percent.unit}) (Range:{" "}
                    {selectedRecord.eosinophils_percent.reference_range})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Basophil:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.basophils_percent.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.basophils_percent.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.basophils_percent.result}) (Unit:{" "}
                    {selectedRecord.basophils_percent.unit}) (Range:{" "}
                    {selectedRecord.basophils_percent.reference_range})
                  </span>
                </div>

                <h4 className={styles.sectionSubtitle}>WBC Absolute Count</h4>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Neutrophil:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.neutrophils_abs.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.neutrophils_abs.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.neutrophils_abs?.result || "N/A"})
                    (Unit: {selectedRecord.neutrophils_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.neutrophils_abs?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Lymphocyte:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.lymphocytes_abs.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.lymphocytes_abs.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.lymphocytes_abs?.result || "N/A"})
                    (Unit: {selectedRecord.lymphocytes_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.lymphocytes_abs?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Monocyte:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.monocytes_abs.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.monocytes_abs.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.monocytes_abs?.result || "N/A"})
                    (Unit: {selectedRecord.monocytes_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.monocytes_abs?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Eosinophil:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.eosinophils_abs.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.eosinophils_abs.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.eosinophils_abs?.result || "N/A"})
                    (Unit: {selectedRecord.eosinophils_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.eosinophils_abs?.reference_range || "N/A"})
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Basophil:</span>
                  <span className={styles.infoValue}>
                    {" "}
                    {selectedRecord.basophils_abs.flag && (
                      <span className={styles.flag}>
                        ({selectedRecord.basophils_abs.flag}){" "}
                      </span>
                    )}
                    (Result: {selectedRecord.basophils_abs?.result || "N/A"})
                    (Unit: {selectedRecord.basophils_abs?.unit || "N/A"})
                    (Range:{" "}
                    {selectedRecord.basophils_abs?.reference_range || "N/A"})
                  </span>
                </div>
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
        </div>
      )}
    </div>
  );
};

export default CbcAdmin;
