import React, { useState} from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";
import styles from "@/styles/XRay.module.css";
import Sidebar from "@/components/Sidebar";
import useGenerateActivity from "@/hooks/useGenerateActivity";

interface MedExamRecord {
  id?: string;
  uniqueId: string;
  fileName: string;
  uploadDate: string;
  pdfUrl: string;

  // Patient Info
  patient_name: string;
  pid: string;
  date_of_birth: string;
  age: number;
  sex: string;
  civil_status: string;
  company: string;
  occupation: string;
  date_of_examination: string;

  // Medical History
  present_illness: string;
  food_allergy: string;
  medication_allergy: string;
  past_consultation: string;
  maintenance_medications: string;
  previous_hospitalizations: string;
  menstrual_history_lmp: string;
  obstetrical_history: string;

  // Vitals
  blood_pressure: string;
  pulse: string;
  spo2: string;
  respiratory_rate: string;
  temperature: string;

  // Anthropometrics
  height: string;
  weight: string;
  bmi: string;
  ibw: string;

  // Vision
  vision_adequacy: string;
  vision_od: string;
  vision_os: string;

  // Laboratory Results
  cbc_result: string;
  urinalysis_result: string;
  blood_chemistry_result: string;
  chest_xray_result: string;
  ecg_result: string;

  // Medical Classification
  fitness_status: string;
  medical_class: string;
  needs_treatment: string;
  remarks: string;

  // Medical Personnel
  examining_physician: string;
  evaluating_personnel: string;
  physician_prc: string;

  // Dates
  date_of_initial_peme: string;
  date_of_fitness: string;
  valid_until: string;

  // Clinical History (Yes/No)
  head_or_neck_injury: string;
  frequent_dizziness: string;
  fainting_spells: string;
  chronic_cough: string;
  heart_disease: string;
  hypertension: string;
  diabetes: string;
  asthma: string;
  epilepsy: string;
  mental_disorder: string;
  tuberculosis: string;
  cancer: string;
  kidney_disease: string;
  others: string;
}


const ReportsAdmin: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [records, setRecords] = useState<MedExamRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<MedExamRecord | null>(
    null
  );
  const [showModal, setShowModal] = useState(false);

  
  // Initialize the activity hook
  const {
    generateActivity,
    isLoading: activityLoading,
    error: activityError,
  } = useGenerateActivity();

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Load all records from Firestore
  const loadRecords = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "medExamRecords"));
      const loadedRecords: MedExamRecord[] = [];

      querySnapshot.forEach((doc) => {
        loadedRecords.push({ id: doc.id, ...doc.data() } as MedExamRecord);
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
      await deleteDoc(doc(db, "medExamRecords", recordId));
      await loadRecords();

      // Log delete activity
      try {
        const patientInfo = recordToDelete
          ? `${recordToDelete.patient_name} (${recordToDelete.uniqueId})`
          : "Unknown patient";
        await generateActivity(
          "medexam_delete",
          `Deleted Medical Exam record for ${patientInfo}`
        );
      } catch (activityErr) {
        console.error("Failed to log delete activity:", activityErr);
      }
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  // Handle viewing record details
  const handleViewRecord = (record: MedExamRecord) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  // Filter records based on search (medical_class and fitness_status)
  const filteredRecords = records.filter(
    (record) =>
      record.medical_class?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.fitness_status?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className={styles.pageTitle}>
            Recommendation Summary
          </h1>
          <p className={styles.pageDescription}>
            View and manage medical examination recommendations and fitness assessments
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
          {/* Search Section */}
          <section className={styles.searchSection}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search by medical class or fitness status..."
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
                  View and manage medical examination results
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
                  {searchTerm 
                    ? "No records match your search criteria. Try adjusting your search terms." 
                    : "No medical examination records available."}
                </p>
              </div>
            ) : (
              <div className={styles.recordsGrid}>
                {filteredRecords.map((record) => (
                  <div key={record.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <div className={styles.patientInfo}>
                        <h3 className={styles.patientName}>
                          {record.patient_name}
                        </h3>
                        <p className={styles.uniqueId}>{record.pid}</p>
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
                        <span className={styles.recordLabel}>Sex:</span>
                        <span className={styles.recordValue}>{record.sex}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Company:</span>
                        <span className={styles.recordValue}>
                          {record.company}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Exam Date:</span>
                        <span className={styles.recordValue}>
                          {record.date_of_examination}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Status:</span>
                        <span
                          className={`${styles.recordValue} ${
                            record.fitness_status === "FIT"
                              ? styles.statusFit
                              : styles.statusUnfit
                          }`}
                        >
                          {record.fitness_status}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Class:</span>
                        <span className={styles.recordValue}>
                          {record.medical_class}
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
              <h3 className={styles.modalTitle}>
                Medical Examination Report Details
              </h3>
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
                      {selectedRecord.patient_name}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>PID:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.pid}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date of Birth:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.date_of_birth}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Age:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.age}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Sex:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.sex}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Civil Status:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.civil_status}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Company:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.company}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Occupation:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.occupation}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
                <h4 className={styles.sectionSubtitle}>Examination Details</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Exam Date:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.date_of_examination}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Initial PEME Date:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.date_of_initial_peme}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date of Fitness:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.date_of_fitness}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Valid Until:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.valid_until}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.vitalSignsSection}>
                <h4 className={styles.sectionSubtitle}>
                  Vital Signs & Measurements
                </h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Blood Pressure:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.blood_pressure}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Pulse:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.pulse}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>SpO2:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.spo2}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Temperature:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.temperature}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Height:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.height}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Weight:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.weight}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>BMI:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.bmi}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>IBW:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.ibw}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.visionSection}>
  <h4 className={styles.sectionSubtitle}>Vision Assessment</h4>
  <div className={styles.infoGrid}>
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>Vision Adequacy:</span>
      <span className={styles.infoValue}>{selectedRecord.vision_adequacy}</span>
    </div>
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>OD:</span>
      <span className={styles.infoValue}>{selectedRecord.vision_od}</span>
    </div>
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>OS:</span>
      <span className={styles.infoValue}>{selectedRecord.vision_os}</span>
    </div>
  </div>
</div>

              <div className={styles.medicalHistorySection}>
                <h4 className={styles.sectionSubtitle}>Medical History</h4>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Present Illness:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.present_illness || "None"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Food Allergy:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.food_allergy || "None"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Medication Allergy:</span>
                  <span className={styles.infoValue}>
                    {selectedRecord.medication_allergy || "None"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    Maintenance Medications:
                  </span>
                  <span className={styles.infoValue}>
                    {selectedRecord.maintenance_medications || "None"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    Previous Hospitalizations:
                  </span>
                  <span className={styles.infoValue}>
                    {selectedRecord.previous_hospitalizations || "None"}
                  </span>
                </div>
                <h4 className={styles.sectionSubtitle}>Clinical History (Yes / No)</h4>
                <div className={styles.infoGrid}>
                    {[
                    ["Head or Neck Injury", selectedRecord.head_or_neck_injury],
                    ["Frequent Dizziness", selectedRecord.frequent_dizziness],
                    ["Fainting Spells", selectedRecord.fainting_spells],
                    ["Chronic Cough", selectedRecord.chronic_cough],
                    ["Heart Disease / Chest Pain", selectedRecord.heart_disease],
                    ["Hypertension", selectedRecord.hypertension],
                    ["Diabetes", selectedRecord.diabetes],
                    ["Asthma", selectedRecord.asthma],
                    ["Epilepsy", selectedRecord.epilepsy],
                    ["Mental Disorder", selectedRecord.mental_disorder],
                    ["Tuberculosis", selectedRecord.tuberculosis],
                    ["Cancer", selectedRecord.cancer],
                    ["Kidney Disease", selectedRecord.kidney_disease],
                    ["Others", selectedRecord.others],
                  ].map(([label, value]) => (
                    <div className={styles.infoItem} key={label}>
                      <span className={styles.infoLabel}>{label}:</span>
                      <span className={styles.infoValue}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.labResultsSection}>
                <h4 className={styles.sectionSubtitle}>Laboratory Results</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>CBC:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.cbc_result}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Urinalysis:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.urinalysis_result}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Blood Chemistry:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.blood_chemistry_result}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Chest X-ray:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.chest_xray_result}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>ECG:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.ecg_result}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.assessmentSection}>
                <h4 className={styles.sectionSubtitle}>Medical Assessment</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Fitness Status:</span>
                    <span
                      className={`${styles.infoValue} ${
                        selectedRecord.fitness_status === "FIT"
                          ? styles.statusFit
                          : styles.statusUnfit
                      }`}
                    >
                      {selectedRecord.fitness_status}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Medical Class:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.medical_class}
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
                </div>
              </div>

              <div className={styles.medicalPersonnelSection}>
                <h4 className={styles.sectionSubtitle}>Medical Personnel</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>
                      Examining Physician:
                    </span>
                    <span className={styles.infoValue}>
                      {selectedRecord.examining_physician}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>
                      Evaluating Personnel:
                    </span>
                    <span className={styles.infoValue}>
                      {selectedRecord.evaluating_personnel}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Physician PRC #:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.physician_prc}
                    </span>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsAdmin;