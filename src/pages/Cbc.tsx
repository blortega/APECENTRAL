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

const Cbc: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<CBCRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CBCRecord | null>(null);
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
      const res = await fetch("http://localhost:8000/extract-cbc", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

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
      await addDoc(collection(db, "cbcRecords"), data);
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
                  View and manage CBC lab results
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
                      (Result: {selectedRecord.rbc.result}) (Unit: {selectedRecord.rbc.unit}) (Range: {selectedRecord.rbc.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Hematocrit:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.hematocrit.result}) (Unit: {selectedRecord.hematocrit.unit}) (Range: {selectedRecord.hematocrit.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Hemoglobin:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.hemoglobin.result}) (Unit: {selectedRecord.hemoglobin.unit}) (Range: {selectedRecord.hemoglobin.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>MCV:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.mcv.result}) (Unit: {selectedRecord.mcv.unit}) (Range: {selectedRecord.mcv.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>MCH:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.mch.result}) (Unit: {selectedRecord.mch.unit}) (Range: {selectedRecord.mch.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>MCHC:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.mchc.result}) (Unit: {selectedRecord.mchc.unit}) (Range: {selectedRecord.mchc.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>RDW:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.rdw.result}) (Unit: {selectedRecord.rdw.unit}) (Range: {selectedRecord.rdw.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Platelet Count:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.platelets.result}) (Unit: {selectedRecord.platelets.unit}) (Range: {selectedRecord.platelets.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>MPV:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.mpv.result}) (Unit: {selectedRecord.mpv.unit}) (Range: {selectedRecord.mpv.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>WBC Count:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.wbc.result}) (Unit: {selectedRecord.wbc.unit}) (Range: {selectedRecord.wbc.reference_range})
                    </span>                    
                  </div>

                <h4 className={styles.sectionSubtitle}>WBC Differential Count</h4>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Neutrophil:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.neutrophils_percent.result}) (Unit: {selectedRecord.neutrophils_percent.unit}) (Range: {selectedRecord.neutrophils_percent.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Lymphocytes:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.lymphocytes_percent.result}) (Unit: {selectedRecord.lymphocytes_percent.unit}) (Range: {selectedRecord.lymphocytes_percent.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Monocytes:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.monocytes_percent.result}) (Unit: {selectedRecord.monocytes_percent.unit}) (Range: {selectedRecord.monocytes_percent.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Eosinophil:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.eosinophils_percent.result}) (Unit: {selectedRecord.eosinophils_percent.unit}) (Range: {selectedRecord.eosinophils_percent.reference_range})
                    </span>                    
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Basophil:</span>
                    <span className={styles.infoValue}>
                      (Result: {selectedRecord.basophils_percent.result}) (Unit: {selectedRecord.basophils_percent.unit}) (Range: {selectedRecord.basophils_percent.reference_range})
                    </span>                   
                  </div>

                  <h4 className={styles.sectionSubtitle}>WBC Absolute Count</h4>

                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Neutrophil:</span>
                    <span className={styles.infoValue}>
                     (Result: {selectedRecord.neutrophils_abs?.result || 'N/A'}) (Unit: {selectedRecord.neutrophils_abs?.unit || 'N/A'}) (Range: {selectedRecord.neutrophils_abs?.reference_range || 'N/A'})
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

export default Cbc;
