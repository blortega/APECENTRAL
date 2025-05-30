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
}

const XRay: React.FC = () => {
  const [records, setRecords] = useState<XRayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<XRayRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract text from PDF using PDF.js (you'll need to install: npm install pdfjs-dist)
  const extractPdfText = async (file: File): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Dynamic import for PDF.js
        const pdfjsLib = await import("pdfjs-dist");

        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer })
              .promise;

            let fullText = "";

            // Extract text from all pages
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(" ");
              fullText += pageText + "\n";
            }

            resolve(fullText);
          } catch (error) {
            console.error("PDF parsing error:", error);
            // Fallback to manual text extraction if PDF.js fails
            const fallbackText = await fallbackTextExtraction(file);
            resolve(fallbackText);
          }
        };

        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("PDF.js import error:", error);
        // Fallback method
        const fallbackText = await fallbackTextExtraction(file);
        resolve(fallbackText);
      }
    });
  };

  // Fallback text extraction method
  const fallbackTextExtraction = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Simple text extraction - attempts to find readable text
        const cleanText = text
          .replace(/[^\x20-\x7E\n\r]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        resolve(cleanText);
      };
      reader.readAsText(file);
    });
  };

  // Updated parsing function to handle X-ray reports with specified fields
  const parseXRayData = (text: string, fileName: string): XRayRecord | null => {
    try {
      const data: Partial<XRayRecord> = {
        patientName: "",
        age: 0,
        gender: "",
        dateOfBirth: "",
        company: "",
        examination: "",
        interpretation: "",
        impression: "",
        fileName,
        uploadDate: new Date().toISOString(),
        uniqueId: fileName.replace(".pdf", ""),
        reportDate: "",
      };

      const clean = (label: string, fallback = "") =>
        (
          text.match(new RegExp(`${label}\\s*:\\s*(.*?)(\\n|$)`, "i"))?.[1] ||
          fallback
        ).trim();

      data.patientName = clean("Patient's Name");
      data.dateOfBirth = clean("Date of Birth");
      data.age = parseInt(clean("Age", "0"));
      data.gender = clean("Gender");
      data.company = clean("Company");
      data.examination = clean("Examination");
      data.reportDate = clean("Date"); // optional if you want to capture the top "Date: Mar-28-2025"

      const interpretationMatch = text.match(
        /Interpretation\s*:\s*(.*?)Impression\s*:/is
      );
      const impressionMatch = text.match(/Impression\s*:\s*(.*)/is);

      data.interpretation = interpretationMatch
        ? interpretationMatch[1].trim()
        : "";
      data.impression = impressionMatch ? impressionMatch[1].trim() : "";

      if (!data.patientName && !data.uniqueId) {
        return null;
      }

      return data as XRayRecord;
    } catch (error) {
      console.error("Error parsing X-ray data:", error);
      return null;
    }
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    setLoading(true);
    setUploadProgress("Starting upload...");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check file type
        if (file.type !== "application/pdf") {
          alert(`File ${file.name} is not a PDF file`);
          continue;
        }

        setUploadProgress(
          `Processing ${file.name}... (${i + 1}/${files.length})`
        );

        // Extract text from PDF
        const extractedText = await extractPdfText(file);

        if (!extractedText.trim()) {
          console.error(`No text extracted from ${file.name}`);
          setUploadProgress(`Failed to extract text from ${file.name}`);
          continue;
        }

        // Parse the extracted text
        const xrayData = parseXRayData(extractedText, file.name);

        if (xrayData) {
          // Check if record already exists
          const existingQuery = query(
            collection(db, "xrayRecords"),
            where("uniqueId", "==", xrayData.uniqueId)
          );
          const existingDocs = await getDocs(existingQuery);

          if (!existingDocs.empty) {
            console.log(`Record for ${xrayData.patientName} already exists`);
            setUploadProgress(
              `Record for ${xrayData.patientName} already exists`
            );
            continue;
          }

          // Save to Firestore
          await addDoc(collection(db, "xrayRecords"), xrayData);
          setUploadProgress(`Saved ${xrayData.patientName}`);
        } else {
          setUploadProgress(`Failed to parse data from ${file.name}`);
        }
      }

      await loadRecords();
      setUploadProgress("Upload completed successfully!");

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadProgress("Upload failed. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(""), 5000);
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

  // Delete record
  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;

    try {
      await deleteDoc(doc(db, "xrayRecords", recordId));
      await loadRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
    }
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
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>X-Ray Records Management</h1>
          <p className={styles.pageDescription}>
            Upload and manage X-ray examination records for comprehensive
            patient care
          </p>
        </div>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default XRay;
