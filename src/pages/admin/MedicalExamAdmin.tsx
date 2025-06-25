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

interface VitalSigns {
  blood_pressure: string;
  pulse: string;
  spo2: string;
  respiratory_rate: string;
  temperature: string;
}

interface Anthropometrics {
  height: string;
  weight: string;
  bmi: string;
  ibw: string;
}

interface VisualAcuity {
  unaided_od: string;
  unaided_os: string;
  aided_od: string;
  aided_os: string;
  near_vision_od: string;
  near_vision_os: string;
}

interface PhysicalFinding {
  normal: boolean;
  findings: string;
}

interface PhysicalFindings {
  skin: PhysicalFinding;
  head_scalp: PhysicalFinding;
  eyes_external: PhysicalFinding;
  pupils: PhysicalFinding;
  ears: PhysicalFinding;
  nose_sinuses: PhysicalFinding;
  neck_lymph: PhysicalFinding;
  thyroid: PhysicalFinding;
  breast_axilla: PhysicalFinding;
  chest_lungs: PhysicalFinding;
  heart: PhysicalFinding;
  abdomen: PhysicalFinding;
  back: PhysicalFinding;
  genito_urinary: PhysicalFinding;
  anus_rectum: PhysicalFinding;
  inguinal_genitals: PhysicalFinding;
  extremities: PhysicalFinding;
  reflexes: PhysicalFinding;
  dental: PhysicalFinding;
}

interface LabFinding {
  normal: boolean;
  findings: string;
}

interface LabFindings {
  cbc: LabFinding;
  urinalysis: LabFinding;
  fecalysis: LabFinding;
  chest_xray: LabFinding;
  ecg: LabFinding;
  blood_chemistry: LabFinding;
  pap_smear: LabFinding;
}

interface MedicalHistory {
  conditions: Record<string, any>;
  past_consultations: string;
  maintenance_medications: string;
  previous_hospitalizations: string;
  allergies: {
    food: string;
    medication: string;
  };
}

interface MedicalExamRecord {
  id?: string;
  patient_name: string;
  pid: string;
  date_of_birth: string;
  age: string;
  sex: string;
  date_of_examination: string;
  exam_type: string;
  control_no: string;
  address: string;
  civil_status: string;
  contact_no: string;
  nationality: string;
  company: string;
  occupation: string;
  present_illness: string;
  
  medical_history: MedicalHistory;
  
  // Menstrual/Obstetrical History (for females)
  lmp: string;
  menopause_year: string;
  pmp: string;
  menstrual_duration: string;
  menstrual_interval: string;
  menstrual_regularity: string;
  obstetrical_history: string;
  
  // Physical Examination
  vital_signs: VitalSigns;
  anthropometrics: Anthropometrics;
  visual_acuity: VisualAcuity;
  color_vision: string;
  hearing: string;
  physical_findings: PhysicalFindings;
  
  // Laboratory and Diagnostic Tests
  lab_findings: LabFindings;
  
  // Medical Evaluation
  fitness_classification: string;
  recommendations: string;
  needs_treatment: string;
  remarks: string;
  date_of_fitness: string;
  valid_until: string;
  
  // Meta information
  examining_physician: string;
  physician_prc: string;
  evaluating_personnel: string;
  evaluating_prc: string;
  file_name: string;
  upload_date: string;
  unique_id: string;
}

const MedicalExamAdmin: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<MedicalExamRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<MedicalExamRecord | null>(null);
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
        const res = await fetch("http://localhost:8000/extract-medical-exam", {
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
          collection(db, "medicalExamRecords"),
          where("unique_id", "==", data.unique_id)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
          console.log(`Record already exists for ${data.patient_name}`);
          continue;
        }

        // Save to Firestore
        await addDoc(collection(db, "medicalExamRecords"), data);
        setUploadProgress(`Saved ${data.patient_name}`);
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
      const querySnapshot = await getDocs(collection(db, "medicalExamRecords"));
      const loadedRecords: MedicalExamRecord[] = [];

      querySnapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as MedicalExamRecord);
      });

      // Sort by upload date (newest first)
      loadedRecords.sort(
        (a, b) =>
          new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime()
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
      await deleteDoc(doc(db, "medicalExamRecords", recordId));
      await loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Filter records based on search
  const filteredRecords = records.filter(
    (record) =>
      record.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.pid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load records on component mount
  React.useEffect(() => {
    loadRecords();
  }, []);

  // Helper function to get fitness classification color
  const getFitnessColor = (classification: string) => {
    if (classification?.includes("A")) return "#28a745"; // Green
    if (classification?.includes("B")) return "#ffc107"; // Yellow
    if (classification?.includes("C")) return "#fd7e14"; // Orange
    if (classification?.includes("D")) return "#dc3545"; // Red
    if (classification?.includes("E")) return "#6c757d"; // Gray
    return "#6c757d";
  };

  // Helper function to render physical finding
  const renderPhysicalFinding = (label: string, finding: PhysicalFinding | undefined) => {
    if (!finding) return null;
    
    return (
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>{label}:</span>
        <span className={styles.infoValue}>
          {finding.normal ? "Normal" : finding.findings || "N/A"}
        </span>
      </div>
    );
  };

  // Helper function to render lab finding
  const renderLabFinding = (label: string, finding: LabFinding | undefined) => {
    if (!finding) return null;
    
    const statusStyle = finding.normal ? 
      { color: "#28a745" } : 
      { color: "#dc3545", fontWeight: "bold" };
    
    return (
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>{label}:</span>
        <span className={styles.infoValue} style={statusStyle}>
          {finding.normal ? "Normal" : finding.findings || "Abnormal"}
        </span>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <Sidebar onToggle={handleSidebarToggle} />
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Medical Examination Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage Medical Examination reports and results.
          </p>
        </div>

        <main className={styles.mainContent}>
          {/* Upload Section */}
          <section className={styles.uploadSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Upload Medical Exam PDFs</h2>
              <p className={styles.sectionDescription}>
                Select PDF files containing Medical Examination Reports
              </p>
            </div>
            <div className={styles.uploadCard}>
              <div className={styles.uploadArea}>
                <div className={styles.uploadIcon}>🏥</div>
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
                placeholder="Search by patient name, PID, or company..."
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
                  View and manage Medical Examination results
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
                  Upload some PDF files to get started or adjust your search criteria.
                </p>
              </div>
            ) : (
              <div className={styles.recordsGrid}>
                {filteredRecords.map((record) => (
                  <div key={record.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <div className={styles.patientInfo}>
                        <h3 className={styles.patientName}>{record.patient_name}</h3>
                        <p className={styles.uniqueId}>PID: {record.pid}</p>
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
                        <span className={styles.recordLabel}>Sex:</span>
                        <span className={styles.recordValue}>{record.sex}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Company:</span>
                        <span className={styles.recordValue}>{record.company}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Exam Date:</span>
                        <span className={styles.recordValue}>{record.date_of_examination}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Fitness:</span>
                        <span 
                          className={styles.recordValue} 
                          style={{ 
                            color: getFitnessColor(record.fitness_classification),
                            fontWeight: "bold"
                          }}
                        >
                          {record.fitness_classification || "N/A"}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>BP:</span>
                        <span className={styles.recordValue}>
                          {record.vital_signs?.blood_pressure || "N/A"}
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
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Medical Examination Report Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              {/* Patient Information */}
              <div className={styles.patientSection}>
                <h4 className={styles.sectionSubtitle}>Patient Information</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Name:</span>
                    <span className={styles.infoValue}>{selectedRecord.patient_name}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>PID:</span>
                    <span className={styles.infoValue}>{selectedRecord.pid}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date of Birth:</span>
                    <span className={styles.infoValue}>{selectedRecord.date_of_birth}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Age:</span>
                    <span className={styles.infoValue}>{selectedRecord.age}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Sex:</span>
                    <span className={styles.infoValue}>{selectedRecord.sex}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Company:</span>
                    <span className={styles.infoValue}>{selectedRecord.company}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Occupation:</span>
                    <span className={styles.infoValue}>{selectedRecord.occupation}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Exam Date:</span>
                    <span className={styles.infoValue}>{selectedRecord.date_of_examination}</span>
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Medical History</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Past Consultations:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.medical_history?.past_consultations || "None"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Maintenance Medications:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.medical_history?.maintenance_medications || "None"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Previous Hospitalizations:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.medical_history?.previous_hospitalizations || "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vital Signs */}
              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Vital Signs</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Blood Pressure:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.vital_signs?.blood_pressure || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Pulse:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.vital_signs?.pulse || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>SpO2:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.vital_signs?.spo2 || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Respiratory Rate:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.vital_signs?.respiratory_rate || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Temperature:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.vital_signs?.temperature || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Anthropometrics */}
              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Anthropometrics</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Height:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.anthropometrics?.height || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Weight:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.anthropometrics?.weight || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>BMI:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.anthropometrics?.bmi || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>IBW:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.anthropometrics?.ibw || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Laboratory Findings */}
              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Laboratory Findings</h4>
                <div className={styles.infoGrid}>
                  {renderLabFinding("Complete Blood Count", selectedRecord.lab_findings?.cbc)}
                  {renderLabFinding("Urinalysis", selectedRecord.lab_findings?.urinalysis)}
                  {renderLabFinding("Fecalysis", selectedRecord.lab_findings?.fecalysis)}
                  {renderLabFinding("Chest X-ray", selectedRecord.lab_findings?.chest_xray)}
                  {renderLabFinding("ECG", selectedRecord.lab_findings?.ecg)}
                  {renderLabFinding("Blood Chemistry", selectedRecord.lab_findings?.blood_chemistry)}
                  {selectedRecord.sex === "FEMALE" && 
                    renderLabFinding("Pap Smear", selectedRecord.lab_findings?.pap_smear)
                  }
                </div>
              </div>

              {/* Physical Findings */}
              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Physical Examination Findings</h4>
                <div className={styles.infoGrid}>
                  {renderPhysicalFinding("Skin", selectedRecord.physical_findings?.skin)}
                  {renderPhysicalFinding("Head/Scalp", selectedRecord.physical_findings?.head_scalp)}
                  {renderPhysicalFinding("Eyes", selectedRecord.physical_findings?.eyes_external)}
                  {renderPhysicalFinding("Ears", selectedRecord.physical_findings?.ears)}
                  {renderPhysicalFinding("Nose/Sinuses", selectedRecord.physical_findings?.nose_sinuses)}
                  {renderPhysicalFinding("Neck/Lymph", selectedRecord.physical_findings?.neck_lymph)}
                  {renderPhysicalFinding("Thyroid", selectedRecord.physical_findings?.thyroid)}
                  {renderPhysicalFinding("Chest/Lungs", selectedRecord.physical_findings?.chest_lungs)}
                  {renderPhysicalFinding("Heart", selectedRecord.physical_findings?.heart)}
                  {renderPhysicalFinding("Abdomen", selectedRecord.physical_findings?.abdomen)}
                  {renderPhysicalFinding("Extremities", selectedRecord.physical_findings?.extremities)}
                </div>
              </div>

              {/* Medical Evaluation */}
              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Medical Evaluation</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Fitness Classification:</span>
                    <span 
                      className={styles.infoValue} 
                      style={{ 
                        color: getFitnessColor(selectedRecord.fitness_classification),
                        fontWeight: "bold"
                      }}
                    >
                      {selectedRecord.fitness_classification || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Needs Treatment:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.needs_treatment || "None"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Remarks:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.remarks || "None"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Examining Physician:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.examining_physician || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>PRC #:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.physician_prc || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menstrual/Obstetrical History (for females only) */}
              {selectedRecord.sex === "FEMALE" && (
                <div className={styles.examSection}>
                  <h4 className={styles.sectionSubtitle}>Menstrual/Obstetrical History</h4>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>LMP:</span>
                      <span className={styles.infoValue}>{selectedRecord.lmp || "N/A"}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Menopause Year:</span>
                      <span className={styles.infoValue}>
                        {selectedRecord.menopause_year || "N/A"}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Obstetrical History:</span>
                      <span className={styles.infoValue}>
                        {selectedRecord.obstetrical_history || "N/A"}
                      </span>
                    </div>
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

export default MedicalExamAdmin;