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

interface UrinalysisRecord {
  id?: string;
  uniqueId: string;
  patientName: string;
  mrn: string;
  gender: string;
  age: number;
  dob: string;
  collectionDateTime: string;
  resultValidated: string;
  color: string;
  clarity: string;
  glucose: string;
  bilirubin: string;
  ketones: string;
  specificGravity: string;
  blood: string;
  ph: string;
  protein: string;
  urobilinogen: string;
  nitrite: string;
  leukocyteEsterase: string;
  rbc: string;
  wbc: string;
  epithelialCells: string;
  bacteria: string;
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
        if (data.error) {
          console.error(`Error in ${file.name}:`, data.error);
          continue;
        }

        const q = query(
          collection(db, "urinalysisRecords"),
          where("uniqueId", "==", data.uniqueId)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${data.patientName}`);
          continue;
        }

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

  const loadRecords = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "urinalysisRecords"));
      const loadedRecords: UrinalysisRecord[] = [];

      querySnapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as UrinalysisRecord);
      });

      loadedRecords.sort(
        (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
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
      await deleteDoc(doc(db, "urinalysisRecords", recordId));
      await loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  const filteredRecords = records.filter((record) =>
    record.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadRecords();
  }, []);

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Urinalysis Records Management</h1>
          <p className={styles.pageDescription}>Upload and manage urinalysis lab results.</p>
        </div>

        <main className={styles.mainContent}>
          <section className={styles.uploadSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Upload Urinalysis PDFs</h2>
              <p className={styles.sectionDescription}>Select PDF files containing urinalysis results</p>
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
                  <p className={styles.uploadMainText}>Choose PDF files or drag and drop</p>
                  <p className={styles.uploadSubText}>Multiple PDF files supported</p>
                </div>
              </div>
              {uploadProgress && <div className={styles.progressMessage}>{uploadProgress}</div>}
            </div>
          </section>

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

          <section className={styles.recordsSection}>
            <div className={styles.recordsHeader}>
              <h2 className={styles.sectionTitle}>Patient Records ({filteredRecords.length})</h2>
              <button
                onClick={loadRecords}
                className={styles.refreshButton}
                disabled={loading}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {filteredRecords.length === 0 ? (
              <div className={styles.noRecords}>No records found.</div>
            ) : (
              <div className={styles.recordsGrid}>
                {filteredRecords.map((record) => (
                  <div key={record.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <div className={styles.patientInfo}>
                        <h3 className={styles.patientName}>{record.patientName}</h3>
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
                      <p><strong>Gender:</strong> {record.gender}</p>
                      <p><strong>Age:</strong> {record.age}</p>
                      <p><strong>Report Date:</strong> {record.collectionDateTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {showModal && selectedRecord && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Urinalysis Result Details</h3>
              <button onClick={() => setShowModal(false)} className={styles.closeButton}>×</button>
            </div>
            <div className={styles.modalContent}>
              <p><strong>Name:</strong> {selectedRecord.patientName}</p>
              <p><strong>DOB:</strong> {selectedRecord.dob}</p>
              <p><strong>Gender:</strong> {selectedRecord.gender}</p>
              <p><strong>Age:</strong> {selectedRecord.age}</p>
              <p><strong>Color:</strong> {selectedRecord.color}</p>
              <p><strong>Clarity:</strong> {selectedRecord.clarity}</p>
              <p><strong>Glucose:</strong> {selectedRecord.glucose}</p>
              <p><strong>Bilirubin:</strong> {selectedRecord.bilirubin}</p>
              <p><strong>Ketones:</strong> {selectedRecord.ketones}</p>
              <p><strong>Specific Gravity:</strong> {selectedRecord.specificGravity}</p>
              <p><strong>Blood:</strong> {selectedRecord.blood}</p>
              <p><strong>pH:</strong> {selectedRecord.ph}</p>
              <p><strong>Protein:</strong> {selectedRecord.protein}</p>
              <p><strong>Urobilinogen:</strong> {selectedRecord.urobilinogen}</p>
              <p><strong>Nitrite:</strong> {selectedRecord.nitrite}</p>
              <p><strong>Leukocyte Esterase:</strong> {selectedRecord.leukocyteEsterase}</p>
              <p><strong>RBC:</strong> {selectedRecord.rbc}</p>
              <p><strong>WBC:</strong> {selectedRecord.wbc}</p>
              <p><strong>Epithelial Cells:</strong> {selectedRecord.epithelialCells}</p>
              <p><strong>Bacteria:</strong> {selectedRecord.bacteria}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Urinalysis;
