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

interface LabValue {
  result: string;
  unit: string;
  reference_range: string;
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
  orderNumber: string,
  location: string,

  
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
  hyaline: LabValue;
  remarks: LabValue;
  
  fileName: string;
  uploadDate: string;
}

const Urinalysis: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<UrinalysisRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<UrinalysisRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };


  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = event.target.files;
  if (!files) return;

  setLoading(true);
  setUploadProgress("Starting upload...");

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.type !== "application/pdf") {
      alert(`File ${file.name} is not a PDF file`);
      continue;
    }

    setUploadProgress(`Processing ${file.name}... (${i + 1}/${files.length})`);

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
    } catch (err) {
      console.error("Upload error:", err);
    }
  }

  await loadRecords();
  setUploadProgress("Upload finished.");
  setLoading(false);
};


  // Load all records from Firestore
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

  // Delete record
  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    try {
      await deleteDoc(doc(db, "urinalysisRecords", recordId));
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
          <h1 className={styles.pageTitle}>Urinalysis Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage Urinalysis lab results.
          </p>
        </div>

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
                  View and manage Urinalysis results
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
                      (Result: {selectedRecord.color?.result || "N/A"}) (Unit: {selectedRecord.color?.unit || "N/A"}) (Range: {selectedRecord.color?.reference_range || "N/A"})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Clarity:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.clarity?.result || "N/A"}) (Unit: {selectedRecord.clarity?.unit || "N/A"}) (Range: {selectedRecord.clarity?.reference_range || "N/A"})
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

export default Urinalysis;