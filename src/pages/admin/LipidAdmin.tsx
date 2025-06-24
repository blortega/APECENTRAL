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
  pdf_path?: string;
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
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

<<<<<<< HEAD
  // Handle PDF viewing with better error handling
  const handleViewPdf = async (record: LipidRecord) => {
    try {
      setLoading(true);
      setUploadProgress("Loading PDF...");
      
      // Check if fileName exists
      if (!record.fileName) {
        alert("PDF file name not found for this record");
        return;
      }

      const response = await fetch(`http://localhost:8000/download-pdf/${encodeURIComponent(record.fileName)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      
      // Verify it's actually a PDF
      if (blob.type !== 'application/pdf' && !blob.type.includes('pdf')) {
        throw new Error('Invalid PDF file received');
      }

      const url = URL.createObjectURL(blob);
      setCurrentPdfUrl(url);
      setShowPdfViewer(true);
      setUploadProgress("");
    } catch (error) {
      console.error("Error viewing PDF:", error);
      setUploadProgress("");
      alert(`Error loading PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle PDF download with better error handling
  const handleDownloadPdf = async (record: LipidRecord) => {
    try {
      setLoading(true);
      setUploadProgress("Downloading PDF...");
      
      if (!record.fileName) {
        alert("PDF file name not found for this record");
        return;
      }

      const response = await fetch(`http://localhost:8000/download-pdf/${encodeURIComponent(record.fileName)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setUploadProgress("Download completed");
      
      // Clear progress after delay
      setTimeout(() => setUploadProgress(""), 2000);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert(`Error downloading PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Close PDF viewer with proper cleanup
  const closePdfViewer = () => {
    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl);
    }
    setCurrentPdfUrl("");
    setShowPdfViewer(false);
  };

  // Enhanced file upload with better error handling
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
=======
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
>>>>>>> 4d1621e64ef87bc83674f967fd1dc7e7ba7a257b
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setUploadProgress("Starting upload...");
    setUploadError("");
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
<<<<<<< HEAD
        
        // Validate file type
=======

>>>>>>> 4d1621e64ef87bc83674f967fd1dc7e7ba7a257b
        if (file.type !== "application/pdf") {
          const errorMsg = `File "${file.name}" is not a PDF file`;
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        // Validate file size (e.g., max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          const errorMsg = `File "${file.name}" is too large (max 10MB)`;
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        setUploadProgress(
          `Processing ${file.name}... (${i + 1}/${files.length})`
        );

        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch("http://localhost:8000/extract-lipid-profile", {
            method: "POST",
            body: formData,
          });

<<<<<<< HEAD
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
=======
        const result = await res.json();

        console.log("Backend response:", result);
>>>>>>> 4d1621e64ef87bc83674f967fd1dc7e7ba7a257b

          const data = await response.json();
          console.log("Parsed Data from backend:", data);

          if (data.error) {
            const errorMsg = `Error in ${file.name}: ${data.error}`;
            errors.push(errorMsg);
            errorCount++;
            continue;
          }

          // Validate required fields
          if (!data.uniqueId || !data.patientName) {
            const errorMsg = `Invalid data extracted from ${file.name}: missing required fields`;
            errors.push(errorMsg);
            errorCount++;
            continue;
          }

          // Check for duplicates in Firestore
          const q = query(
            collection(db, "lipidProfileRecords"),
            where("uniqueId", "==", data.uniqueId)
          );
          const existing = await getDocs(q);

          if (!existing.empty) {
            const errorMsg = `Record already exists for patient: ${data.patientName} (ID: ${data.uniqueId})`;
            errors.push(errorMsg);
            errorCount++;
            continue;
          }

          // Add upload timestamp
          const recordData = {
            ...data,
            uploadDate: new Date().toISOString(),
          };

          // Save to Firestore
          await addDoc(collection(db, "lipidProfileRecords"), recordData);
          setUploadProgress(`Saved record for ${data.patientName}`);
          successCount++;

        } catch (fetchError) {
          const errorMsg = `Failed to process ${file.name}: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`;
          errors.push(errorMsg);
          errorCount++;
          console.error("Upload error for file:", file.name, fetchError);
        }
      }

      // Show summary
      let summaryMessage = `Upload completed: ${successCount} successful`;
      if (errorCount > 0) {
        summaryMessage += `, ${errorCount} failed`;
      }
      setUploadProgress(summaryMessage);

      // Show errors if any
      if (errors.length > 0) {
        setUploadError(errors.join('\n'));
      }

      // Reload records
      await loadRecords();

    } catch (error) {
      console.error("General upload error:", error);
      setUploadError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
<<<<<<< HEAD
      
      // Clear progress after delay
      setTimeout(() => {
        setUploadProgress("");
        setUploadError("");
      }, 5000);
=======

      setUploadProgress("Upload completed!");
    } catch (err) {
      console.error("Upload error:", err);
      setUploadProgress(`Upload failed: ${err}`);
    } finally {
      await loadRecords();
      setTimeout(() => setUploadProgress(""), 3000); // Clear message after 3 seconds
      setLoading(false);
>>>>>>> 4d1621e64ef87bc83674f967fd1dc7e7ba7a257b
    }
  };

  // Load all records from Firestore with error handling
  const loadRecords = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "lipidProfileRecords"));
      const loadedRecords: LipidRecord[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedRecords.push({ 
          id: doc.id, 
          ...data,
          // Ensure uploadDate exists
          uploadDate: data.uploadDate || new Date().toISOString()
        } as LipidRecord);
      });

      // Sort by upload date (newest first)
      loadedRecords.sort((a, b) => {
        const dateA = new Date(a.uploadDate || 0).getTime();
        const dateB = new Date(b.uploadDate || 0).getTime();
        return dateB - dateA;
      });

      setRecords(loadedRecords);
    } catch (error) {
      console.error("Error loading records:", error);
      alert("Error loading records from database");
    } finally {
      setLoading(false);
    }
  };

  // Delete record with confirmation
  const handleDeleteRecord = async (recordId: string) => {
    if (!recordId) {
      alert("Invalid record ID");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      await deleteDoc(doc(db, "lipidProfileRecords", recordId));
      await loadRecords();
      alert("Record deleted successfully");
    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Error deleting record");
    } finally {
      setLoading(false);
    }
  };

  // Filter records based on search with null checks
  const filteredRecords = records.filter((record) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (record.patientName?.toLowerCase().includes(searchLower) || false) ||
      (record.uniqueId?.toLowerCase().includes(searchLower) || false) ||
      (record.mrn?.toLowerCase().includes(searchLower) || false)
    );
  });

  // Load records on component mount
  React.useEffect(() => {
    loadRecords();
  }, []);

  // Helper function to get flag color
  const getFlagColor = (flag: string) => {
    if (!flag) return '#666';
    switch (flag.toUpperCase()) {
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
    
    const flagStyle = value.flag ? { color: getFlagColor(value.flag), fontWeight: 'bold' as const } : {};
    
    return (
      <div className={styles.infoItem}>
        <span className={styles.infoLabel}>{label}:</span>
        <span className={styles.infoValue} style={flagStyle}>
          {value.result ? (
            <>
              <strong>{value.result}</strong>
              {value.flag && <span> ({value.flag})</span>}
              {value.unit && <span> {value.unit}</span>}
              {value.reference_range && <span> | Ref: {value.reference_range}</span>}
            </>
          ) : (
            "N/A"
          )}
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
                Select PDF files containing Lipid Profile Results (Max 10MB per file)
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
                    Multiple PDF files supported (Max 10MB each)
                  </p>
                </div>
              </div>
              {uploadProgress && (
                <div className={styles.progressMessage}>{uploadProgress}</div>
              )}
              {uploadError && (
                <div className={styles.errorMessage} style={{ color: 'red', whiteSpace: 'pre-line', marginTop: '10px' }}>
                  {uploadError}
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
                  {records.length === 0 
                    ? "Upload some PDF files to get started."
                    : "No records match your search criteria. Try adjusting your search."
                  }
                </p>
              </div>
            ) : (
              <div className={styles.recordsGrid}>
                {filteredRecords.map((record) => (
                  <div key={record.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <div className={styles.patientInfo}>
                        <h3 className={styles.patientName}>
                          {record.patientName || "Unknown Patient"}
                        </h3>
                        <p className={styles.uniqueId}>{record.uniqueId || "No ID"}</p>
                      </div>
                      <div className={styles.recordActions}>
                        <button
                          onClick={() => {
                            setSelectedRecord(record);
                            setShowModal(true);
                          }}
                          className={styles.viewButton}
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleViewPdf(record)}
                          className={styles.pdfButton}
                          disabled={!record.fileName || loading}
                          style={{ 
                            backgroundColor: record.fileName ? '#28a745' : '#6c757d', 
                            color: 'white', 
                            margin: '0 2px',
                            cursor: record.fileName && !loading ? 'pointer' : 'not-allowed'
                          }}
                        >
                          View PDF
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(record)}
                          className={styles.downloadButton}
                          disabled={!record.fileName || loading}
                          style={{ 
                            backgroundColor: record.fileName ? '#17a2b8' : '#6c757d', 
                            color: 'white', 
                            margin: '0 2px',
                            cursor: record.fileName && !loading ? 'pointer' : 'not-allowed'
                          }}
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id!)}
                          className={styles.deleteButton}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className={styles.recordDetails}>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Age:</span>
                        <span className={styles.recordValue}>{record.age || "N/A"}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>Gender:</span>
                        <span className={styles.recordValue}>
                          {record.gender || "N/A"}
                        </span>
                      </div>
                      <div className={styles.recordItem}>
<<<<<<< HEAD
                        <span className={styles.recordLabel}>Report Date:</span>
                        <span className={styles.recordValue}>
                          {record.collectionDateTime || "N/A"}
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
=======
                        <span className={styles.recordLabel}>MRN:</span>
                        <span className={styles.recordValue}>{record.mrn}</span>
                      </div>
                      <div className={styles.recordItem}>
                        <span className={styles.recordLabel}>
                          Collection Date:
                        </span>
                        <span className={styles.recordValue}>
                          {record.collectionDateTime}
>>>>>>> 4d1621e64ef87bc83674f967fd1dc7e7ba7a257b
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
<<<<<<< HEAD
              <h3 className={styles.modalTitle}>Lipid Profile Result Details</h3>
=======
              <h3 className={styles.modalTitle}>
                Lipid Profile Report Details
              </h3>
>>>>>>> 4d1621e64ef87bc83674f967fd1dc7e7ba7a257b
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
                      {selectedRecord.patientName || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>MRN:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.mrn || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date of Birth:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.dob || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Age:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.age || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Gender:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.gender || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Unique ID:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.uniqueId || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Collection Date:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.collectionDateTime || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Result Validated:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.resultValidated || "N/A"}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Location:</span>
                    <span className={styles.infoValue}>
                      {selectedRecord.location || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.examSection}>
<<<<<<< HEAD
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
                  </div>
=======
                <h4 className={styles.sectionSubtitle}>
                  Collection & Validation
                </h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>
                      Collection Date/Time:
                    </span>
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
                </div>
              </div>

              <div className={styles.resultsSection}>
                <h4 className={styles.sectionSubtitle}>Test Results</h4>
                <div className={styles.resultsTable}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f5f5f5" }}>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Test
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Result
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Unit
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Reference Range
                        </th>
                        <th
                          style={{
                            border: "1px solid #ddd",
                            padding: "8px",
                            textAlign: "left",
                          }}
                        >
                          Flag
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedRecord.testResults).map(
                        ([test, data]) => (
                          <tr key={test}>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                              }}
                            >
                              {test}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                                fontWeight: "bold",
                              }}
                            >
                              {data.result}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                              }}
                            >
                              {data.unit}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                              }}
                            >
                              {data.reference_range}
                            </td>
                            <td
                              style={{
                                border: "1px solid #ddd",
                                padding: "8px",
                                color:
                                  data.flag === "H"
                                    ? "red"
                                    : data.flag === "L"
                                    ? "blue"
                                    : "black",
                                fontWeight: data.flag ? "bold" : "normal",
                              }}
                            >
                              {data.flag || "-"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
>>>>>>> 4d1621e64ef87bc83674f967fd1dc7e7ba7a257b
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {showPdfViewer && currentPdfUrl && (
        <div className={styles.modalOverlay} onClick={closePdfViewer}>
          <div 
            className={styles.pdfModal} 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90vw',
              height: '90vh',
              backgroundColor: 'white',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>PDF Viewer</h3>
              <button onClick={closePdfViewer} className={styles.closeButton}>
                ×
              </button>
            </div>
            <div style={{ flex: 1, padding: '10px' }}>
              <iframe
                src={currentPdfUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: '4px'
                }}
                title="PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LipidAdmin;
