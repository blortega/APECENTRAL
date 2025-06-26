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

interface LipidValue {
  result: string;
  unit: string;
  reference_range: string;
  flag: string;
}

interface LipidRecord {
  id?: string;
  uniqueId: string;
  patientName: string;
  mrn: string;
  gender: string;
  age: string;
  dob: string;
  collectionDateTime: string;
  resultValidated: string;
  location: string;

  // Lipid Profile Fields
  alt_sgpt: LipidValue;
  total_cholesterol: LipidValue;
  triglycerides: LipidValue;
  hdl_cholesterol: LipidValue;
  ldl_cholesterol: LipidValue;
  vldl: LipidValue;

  fileName: string;
  uploadDate: string;
  pdfUrl: string;
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

  const {
      generateActivity,
    } = useGenerateActivity();

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Handle file upload
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
        const res = await fetch("http://localhost:8000/upload-and-store?type=lipid", {
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
        const q = query(
          collection(db, "lipidProfileRecords"),
          where("uniqueId", "==", data.uniqueId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${data.patientName}`);
          continue;
        }

        // Save to Firestore
        await addDoc(collection(db, "lipidProfileRecords"), 
        {...data, pdfUrl});
        setUploadProgress(`Saved ${data.patientName}`);
        successfulUploads++;
      try {
          await generateActivity(
            "lipid_upload",
            `Uploaded Lipid Profile record for ${data.patientName} (${data.uniqueId})`
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
    if (successfulUploads > 0) {
      try {
        await generateActivity(
          "lipid_add",
          `Successfully uploaded ${successfulUploads} lipid record${
            successfulUploads > 1 ? "s" : ""
          } from ${totalFiles} file${totalFiles > 1 ? "s" : ""}`
        );
      } catch (err) {
        console.error("Failed to log upload activity:", err);
      }
    }
  };

  // Load all records from Firestore
  const loadRecords = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "lipidProfileRecords"));
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

  // Delete record
  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    try {
      await deleteDoc(doc(db, "lipidProfileRecords", recordId));
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

  // Helper function to get flag color
  const getFlagColor = (flag: string) => {
    switch (flag?.toUpperCase()) {
      case 'H':
        return '#ff4444'; // Red for high
      case 'L':
        return '#4444ff'; // Blue for low
      default:
        return '#666'; // Default color
    }
  };

  // Helper function to render lab value with flag styling
  const renderLabValue = (label: string, value: LipidValue | undefined) => {
    if (!value) return null;
    
    const flagStyle = value.flag ? { color: getFlagColor(value.flag), fontWeight: 'bold' } : {};
    
    return (
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>{label}:</span>
        <span className={styles.infoValue} style={flagStyle}>
          {value.result && (
            <>
              <strong>{value.result}</strong>
              {value.flag && <span> ({value.flag})</span>}
              {value.unit && <span> {value.unit}</span>}
              {value.reference_range && <span> | Ref: {value.reference_range}</span>}
            </>
          )}
          {!value.result && "N/A"}
        </span>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Lipid Profile Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage Lipid Profile lab results.
          </p>
        </div>

        <main className={styles.mainContent}>
          {/* Upload Section */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Upload Lipid Profile PDFs</h2>
              <p className={styles.sectionDescription}>
                Select PDF files containing Lipid Profile Results
              </p>
            </div>
            <div className={styles.uploadCard}>
              <div className={styles.uploadArea}>
                <div className={styles.uploadIcon}>📊</div>
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
                placeholder="Search by patient name or ID..."
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
                  View and manage Lipid Profile results
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
                        <span className={styles.recordLabel}>Report Date:</span>
                        <span className={styles.recordValue}>
                          {record.collectionDateTime}
                        </span>
                      </div>
                      {/* Quick view of key lipid values */}
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Total Cholesterol:</span>
                        <span className={styles.recordValue} style={{ color: getFlagColor(record.total_cholesterol?.flag) }}>
                          {record.total_cholesterol?.result || "N/A"}
                          {record.total_cholesterol?.flag && ` (${record.total_cholesterol.flag})`}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>HDL:</span>
                        <span className={styles.recordValue} style={{ color: getFlagColor(record.hdl_cholesterol?.flag) }}>
                          {record.hdl_cholesterol?.result || "N/A"}
                          {record.hdl_cholesterol?.flag && ` (${record.hdl_cholesterol.flag})`}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>LDL:</span>
                        <span className={styles.recordValue} style={{ color: getFlagColor(record.ldl_cholesterol?.flag) }}>
                          {record.ldl_cholesterol?.result || "N/A"}
                          {record.ldl_cholesterol?.flag && ` (${record.ldl_cholesterol.flag})`}
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
              <h3 className={styles.modalTitle}>Lipid Profile Result Details</h3>
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
                    <span className={styles.infoLabel}>MRN:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.mrn}
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
                    <span className={styles.infoLabel}>Collection Date:</span>
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
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Location:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.location}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Chemistry - Immunology</h4>
                
                <h5 className={styles.sectionSubtitle}>Liver Function Test</h5>
                {renderLabValue("ALT/SGPT", selectedRecord.alt_sgpt)}

                <h5 className={styles.sectionSubtitle}>Lipid Profile</h5>
                {renderLabValue("Total Cholesterol", selectedRecord.total_cholesterol)}
                {renderLabValue("Triglycerides", selectedRecord.triglycerides)}
                {renderLabValue("HDL Cholesterol", selectedRecord.hdl_cholesterol)}
                {renderLabValue("LDL Cholesterol", selectedRecord.ldl_cholesterol)}
                {renderLabValue("VLDL", selectedRecord.vldl)}

                {/* Summary Section */}
                <div className={styles.summarySection} style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <h5 className={styles.sectionSubtitle}>Risk Assessment Summary</h5>
                  <div className={styles.riskGrid}>
                    <div className={styles.riskItem}>
                      <span className={styles.riskLabel}>Total Cholesterol:</span>
                      <span className={styles.riskValue}>
                        {selectedRecord.total_cholesterol?.result ? (
                          parseFloat(selectedRecord.total_cholesterol.result) > 200 ? "High Risk" :
                          parseFloat(selectedRecord.total_cholesterol.result) < 150 ? "Low Risk" : "Normal"
                        ) : "N/A"}
                      </span>
                    </div>
                    <div className={styles.riskItem}>
                      <span className={styles.riskLabel}>HDL Status:</span>
                      <span className={styles.riskValue}>
                        {selectedRecord.hdl_cholesterol?.result ? (
                          parseFloat(selectedRecord.hdl_cholesterol.result) > 75 ? "High (Good)" :
                          parseFloat(selectedRecord.hdl_cholesterol.result) < 40 ? "Low (Risk)" : "Normal"
                        ) : "N/A"}
                      </span>
                    </div>
                    <div className={styles.riskItem}>
                      <span className={styles.riskLabel}>LDL Status:</span>
                      <span className={styles.riskValue}>
                        {selectedRecord.ldl_cholesterol?.result ? (
                          parseFloat(selectedRecord.ldl_cholesterol.result) > 130 ? "High Risk" :
                          parseFloat(selectedRecord.ldl_cholesterol.result) < 50 ? "Low Risk" : "Normal"
                        ) : "N/A"}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default LipidAdmin;
