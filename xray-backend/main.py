from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from urllib.parse import quote
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import fitz  # PyMuPDF
from typing import Dict
from datetime import datetime
import re
import os
from pathlib import Path
import shutil
import traceback


app = FastAPI()

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Update your existing CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://apecentral.vercel.app"],  # Add both localhost variants
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicitly list methods
    allow_headers=["*"],
    expose_headers=["*"]  # Add this to expose all headers
)

@app.get("/")
async def root():
    return {"message": "Medical Records API is running"}



@app.post("/upload-and-store")
async def upload_and_store(request: Request, file: UploadFile = File(...), type: str = "xray") -> Dict:
    try:
        # Validate type
        valid_types = ["xray", "cbc", "urinalysis", "lipid", "ecg", "medical", "chem"]
        if type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Unknown report type: {type}. Expected one of: {', '.join(valid_types)}")

        # Save PDF to disk
        unique_id = Path(file.filename).stem
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # Extract text
        pdf = fitz.open(stream=content, filetype="pdf")
        full_text = "".join(page.get_text() for page in pdf)
        pdf.close()

        # Dispatch to correct parser
        if type == "xray":
            data = parse_xray_data(full_text, file.filename)
        elif type == "cbc":
            data = parse_cbc_data(full_text, file.filename)
        elif type == "urinalysis":
            data = parse_urinalysis(full_text, file.filename)
        elif type == "lipid":
            data = parse_lipid_profile(full_text, file.filename)
        elif type == "ecg":
            data = parse_ecg_data(full_text, file.filename)
        elif type == "medical":
            data = parse_medical_exam(full_text, file.filename)
        elif type == "chem":
            data = parse_chemistry(full_text, file.filename)

        # Dynamically get base URL
        
        encoded_filename = quote(file.filename)
        data["pdfUrl"] = encoded_filename

        return {
            "data": data,
            "pdfUrl": encoded_filename,
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

@app.get("/view-pdf/{filename}")
def view_pdf(filename: str):
    safe_path = Path(UPLOAD_DIR) / Path(filename).name  # strips any subdir tricks
    if not safe_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(
    path=safe_path,
    media_type="application/pdf",
    filename=filename,
    headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )


@app.post("/extract-xray")
async def extract_xray(file: UploadFile = File(...)) -> Dict:
    content = await file.read()
    pdf = fitz.open(stream=content, filetype="pdf")
    full_text = ""
    for page in pdf:
        full_text += page.get_text()

    # Extract fields from text
    data = parse_xray_data(full_text, file.filename)
    return data

def parse_xray_data(text: str, filename: str) -> Dict:
    def extract(label):
        match = re.search(rf"{label}\s*:\s*(.+)", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""

    def extract_between(start, end):
        pattern = rf"{start}\s*:\s*(.*?)(?=\n{end}\s*:|\Z)"
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else ""
    
    def extract_age():
        age_text = extract("Age")
        match = re.search(r'\d+', age_text)
        return int(match.group()) if match else 0
    
    def extract_name():
        return extract("Patient's Name") or extract("Name")

    return {
        "patientName": extract_name(),
        "dateOfBirth": extract("Date of Birth"),
        "age": extract_age(),
        "gender": extract("Gender"),
        "company": extract("Company"),
        "examination": extract("Examination"),
        "reportDate": extract("Date"),
        "interpretation": extract_between("Interpretation", "Impression") or extract("Interpretation"),
        "impression": extract("Impression"),
        "fileName": filename,
        "uploadDate": datetime.utcnow().isoformat(),
        "uniqueId": filename.replace(".pdf", ""),
    }

@app.post("/extract-cbc")
async def extract_cbc(file: UploadFile = File(...)) -> Dict:
    content = await file.read()
    pdf = fitz.open(stream=content, filetype="pdf")
    full_text = ""
    for page in pdf:
        full_text += page.get_text()

    data = parse_cbc_data(full_text, file.filename)
    return data

def parse_cbc_data(text: str, filename: str) -> Dict:
    def get_cbc_value(label: str):
        # Updated pattern to handle L/H flags
        # Match: Label [L|H]? <spaces> result <spaces> unit <spaces> reference range
        pattern = rf"{re.escape(label)}\s*([LH])?\s+([\d.]+)\s+([^\s]+)\s+([\d.\- ]+)"
        match = re.search(pattern, text)
        if match:
            flag = match.group(1) if match.group(1) else ""  # L, H, or empty
            return {
                "result": match.group(2).strip(),
                "unit": match.group(3).strip(),
                "reference_range": match.group(4).strip(),
                "flag": flag
            }
        return {
            "result": "",
            "unit": "",
            "reference_range": "",
            "flag": ""
        }
    
    def extract_absolute_block(text: str) -> str:
        # First try with ABSOLUTE COUNT anchor
        match = re.search(r"(?<=ABSOLUTE COUNT)[\s\S]*?(?=\n[A-Z])", text, re.IGNORECASE)
        if match and match.group(0).strip():
            absolute_count_block = match.group(0).strip()
            print("[DEBUG] Extracted ABSOLUTE COUNT block:")
            print(absolute_count_block)
            return absolute_count_block

        # Fallback: Try WBC Absolute Count patterns
        fallback_patterns = [
            r"WBC\s+Absolute\s+Count\s*(.*?)(?=\n\s*MEDICAL|\n\s*PRC|\Z)",  # Until signatures
            r"WBC\s+Absolute\s+Count\s*(.*?)(?=\n[A-Z][A-Z\s]*:)",          # Until next section
            r"WBC\s+Absolute\s+Count\s*(.*)"                               # Everything after
        ]

        for pattern in fallback_patterns:
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if match and match.group(1).strip():
                block = match.group(1).strip()
                print("[DEBUG] Extracted fallback WBC Absolute Count block:")
                print(block)
                return block

        # If all else fails
        print("[DEBUG] No ABSOLUTE COUNT block found.")
        return ""


    def get_cbc_value_from_block(label: str, block: str):
        # Updated pattern to handle L/H flags in absolute count block
        patterns = [
            rf"{re.escape(label)}\s*([LH])?\s+([\d.]+)\s+(\#)\s+([\d.\- ]+)",
            rf"{re.escape(label)}\s*([LH])?\s+([\d.]+)\s+([^\s\n]+)\s+([\d.\- ]+)",
            rf"{re.escape(label)}\s*([LH])?\s+([\d.]+)\s+([^\n]+)"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, block, re.IGNORECASE)
            if match:
                groups = match.groups()
                flag = groups[0] if groups[0] else ""  # L, H, or empty
                return {
                    "result": groups[1].strip(),
                    "unit": groups[2].strip() if len(groups) > 2 else "#",
                    "reference_range": groups[3].strip() if len(groups) > 3 else "",
                    "flag": flag
                }
        
        return {
            "result": "",
            "unit": "",
            "reference_range": "",
            "flag": ""
        }

    def extract_total_wbc_percent(text: str) -> str:
        match = re.search(r"Total\s*:\s*(\d+)", text)
        return match.group(1) if match else ""

    def extract_patient_info(field: str, fallback=""):
        match = re.search(rf"{re.escape(field)}\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
        return match.group(1).strip() if match else fallback

    def extract_gender():
        match = re.search(r"Gender\s*/\s*Age\s*:\s*(\w+)\s*/\s*(\d+)", text)
        if match:
            return match.group(1), int(match.group(2))
        return "", 0

    gender, age = extract_gender()

    # Extract the WBC Absolute Count block
    absolute_count_block = extract_absolute_block(text)

    return {
        # Patient Info
        "patientName": extract_patient_info("Name").strip(),
        "mrn": extract_patient_info("MRN"),
        "gender": gender,
        "age": age,
        "dob": extract_patient_info("DOB"),
        "collectionDateTime": extract_patient_info("Collection Date/Time"),
        "resultValidated": extract_patient_info("Result Validated"),

        # CBC Core Panel
        "rbc": get_cbc_value("RBC Count"),
        "hematocrit": get_cbc_value("Hematocrit"),
        "hemoglobin": get_cbc_value("Hemoglobin"),
        "mcv": get_cbc_value("MCV"),
        "mch": get_cbc_value("MCH"),
        "mchc": get_cbc_value("MCHC"),
        "rdw": get_cbc_value("RDW"),
        "platelets": get_cbc_value("Platelet Count"),
        "mpv": get_cbc_value("MPV"),
        "wbc": get_cbc_value("WBC Count"),

        # WBC Differential Count (%) - These should come from the main text
        "neutrophils_percent": get_cbc_value("Neutrophil"),
        "lymphocytes_percent": get_cbc_value("Lymphocytes"),
        "monocytes_percent": get_cbc_value("Monocytes"),
        "eosinophils_percent": get_cbc_value("Eosinophil"),
        "basophils_percent": get_cbc_value("Basophil"),
        "total_percent": extract_total_wbc_percent(text),

        # WBC Absolute Counts (#) - These should come from the absolute count block
        "neutrophils_abs": get_cbc_value_from_block("Neutrophil", absolute_count_block),
        "lymphocytes_abs": get_cbc_value_from_block("Lymphocyte", absolute_count_block),
        "monocytes_abs": get_cbc_value_from_block("Monocyte", absolute_count_block),
        "eosinophils_abs": get_cbc_value_from_block("Eosinophil", absolute_count_block),
        "basophils_abs": get_cbc_value_from_block("Basophil", absolute_count_block),

        # File Info
        "fileName": filename,
        "uploadDate": datetime.utcnow().isoformat(),
        "uniqueId": filename.replace(".pdf", "")
    }

@app.post("/extract-urinalysis")
async def extract_urinalysis(file: UploadFile = File(...)) -> Dict:
    content = await file.read()
    pdf = fitz.open(stream=content, filetype="pdf")
    text = "".join(page.get_text() for page in pdf)

    return parse_urinalysis(text, file.filename)


def extract_patient_info(text: str, label: str, fallback: str = "") -> str:
    match = re.search(rf"{re.escape(label)}\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
    return match.group(1).strip() if match else fallback

def extract_gender_age(text: str):
    match = re.search(r"Gender\s*/\s*Age\s*[:\-]?\s*(\w+)\s*/\s*(.+)", text)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return "", ""

def extract_urinalysis_value(text: str, label: str, ref_pattern: str = None):
    """
    Extracts result, unit, and reference range for a urinalysis label.
    Handles cases where result+unit+label are squished together.
    """

    
    # Pre-process known edge cases to make them easier to match
    spaced_text = (
        text.replace("RAREEpithelial Cells", "RARE Epithelial Cells")
            .replace("RAREBacteria", "RARE Bacteria")
            .replace("FEWEpithelial Cells", "FEW Epithelial Cells")
            .replace("FEWBacteria", "FEW Bacteria")
            .replace("MANYEpithelial Cells", "MANY Epithelial Cells")
            .replace("MANYBacteria", "MANY Bacteria")
    )

    # Debug: Print what we're looking for
    print(f"Looking for label: {label}")
    
    # Handle Urobilinogen: "0.2 - 1.0EU/dL0.2Urobilinogen"
    if label.lower() == "urobilinogen":
        # Look for the complete pattern in the text
        pattern = r"([\d.]+ - [\d.]+)(EU/dL)([\d.]+)" + re.escape(label)
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            print(f"Urobilinogen match: {match.groups()}")
            return {
                "result": match.group(3),  # 0.2
                "unit": match.group(2),    # EU/dL
                "reference_range": match.group(1),  # 0.2 - 1.0
                "flag": ""
            }
        # Fallback pattern if spacing is different
        pattern2 = r"([\d.]+ - [\d.]+)\s*(EU/dL)\s*([\d.]+)\s*" + re.escape(label)
        match2 = re.search(pattern2, text, re.IGNORECASE)
        if match2:
            return {
                "result": match2.group(3),
                "unit": match2.group(2),
                "reference_range": match2.group(1),
                "flag": ""
            }
        
    # Handle RBC and WBC: "0.0 - 2.0/hpf0.0RBC" or "0.0 - 2.0/hpf0.1WBC"
    if label.lower() in ["rbc", "wbc"]:
        # Pattern: (reference_range)/hpf(result)Label
        pattern = r"([\d.]+ - [\d.]+)/hpf([\d.]+)" + re.escape(label)
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            print(f"{label} match: {match.groups()}")
            return {
                "result": match.group(2),  # 0.0 or 0.1
                "unit": "/hpf",           
                "reference_range": match.group(1),  # 0.0 - 2.0
                "flag": ""
            }
        # Fallback with spacing
        pattern2 = r"([\d.]+ - [\d.]+)\s*/hpf\s*([\d.]+)\s*" + re.escape(label)
        match2 = re.search(pattern2, text, re.IGNORECASE)
        if match2:
            return {
                "result": match2.group(2),
                "unit": "/hpf",
                "reference_range": match2.group(1),
                "flag": ""
            }

    # Handle Epithelial Cells and Bacteria: "/hpf0.2 RAREEpithelial Cells" or "/hpf2.6 RAREBacteria"
    if label.lower() in ["epithelial cells", "bacteria"]:
        # First try the spaced version
        pattern = r"/hpf\s*([\d.]+)\s*(RARE|FEW|MANY)\s*" + re.escape(label)
        match = re.search(pattern, spaced_text, re.IGNORECASE)
        if match:
            print(f"{label} match: {match.groups()}")
            result_parts = []
            if match.group(1):
                result_parts.append(match.group(1))
            if match.group(2):
                result_parts.append(match.group(2))
            
            return {
                "result": " ".join(result_parts),
                "unit": "/hpf",
                "reference_range": "",
                "flag": ""
            }
        
        # Try original concatenated pattern
        pattern2 = r"/hpf([\d.]+)\s*(RARE|FEW|MANY)" + re.escape(label)
        match2 = re.search(pattern2, text, re.IGNORECASE)
        if match2:
            result_parts = []
            if match2.group(1):
                result_parts.append(match2.group(1))
            if match2.group(2):
                result_parts.append(match2.group(2))
            
            return {
                "result": " ".join(result_parts),
                "unit": "/hpf", 
                "reference_range": "",
                "flag": ""
            }

    # Handle Hyaline Cast: Just "Hyaline Cast" with no preceding values
    if label.lower() == "hyaline cast":
        # Check if there's any value before "Hyaline Cast"
        # In the PDF, it appears to be just "Hyaline Cast" with no value
        return {
            "result": "",  # No result value found in PDF
            "unit": "",
            "reference_range": "",
            "flag": ""
        }

    # Handle Remarks: "!Remarks:"
    if "remarks" in label.lower():
        # The remarks appear to be just the "!" character before "Remarks:"
        return {
            "result": "!",  # The exclamation mark
            "unit": "",
            "reference_range": "",
            "flag": ""
        }

    # Handle PH case: "6.0PH" 
    if label.lower() == "ph":
        pattern = r"([\d.]+)\s*" + re.escape(label)
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return {
                "result": match.group(1),
                "unit": "",
                "reference_range": "",
                "flag": ""
            }

    # Handle Specific Gravity: "1.005Specific Gravity"
    if label.lower() == "specific gravity":
        pattern = r"([\d.]+)\s*" + re.escape(label)
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return {
                "result": match.group(1),
                "unit": "",
                "reference_range": "",
                "flag": ""
            }

    # General case for simple patterns like "NEGATIVEGlucose", "ClearClarity", "YellowColor"
    # Pattern: (value)Label
    pattern = r"([A-Za-z]+)\s*" + re.escape(label)
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        result = match.group(1).strip()
        return {
            "result": result,
            "unit": "",
            "reference_range": "",
            "flag": ""
        }

    # Default empty structure
    return {
        "result": "",
        "unit": "",
        "reference_range": "",
        "flag": ""
    }


# Test the extraction with your actual PDF data
def test_extraction():
    """Test the extraction with your actual PDF data"""
    pdf_text = """0.2 - 1.0EU/dL0.2Urobilinogen
            0.0 - 2.0/hpf0.0RBC
            0.0 - 2.0/hpf0.1WBC
            /hpf0.2 RAREEpithelial Cells
                /hpf2.6 RAREBacteria"""
    
    # Test critical fields
    test_fields = [
        "Urobilinogen",
        "RBC", 
        "WBC",
        "Epithelial Cells",
        "Bacteria"
    ]
    
    print("=== TESTING EXTRACTION ===")
    for field in test_fields:
        result = extract_urinalysis_value(pdf_text, field)
        print(f"{field}: {result}")
        
    print("\n=== EXPECTED RESULTS ===")
    print("Urobilinogen: result=0.2, unit=EU/dL, reference_range=0.2 - 1.0")
    print("RBC: result=0.0, unit=/hpf, reference_range=0.0 - 2.0")  
    print("WBC: result=0.1, unit=/hpf, reference_range=0.0 - 2.0")
    print("Epithelial Cells: result=0.2 RARE, unit=/hpf")
    print("Bacteria: result=2.6 RARE, unit=/hpf")
    
# Uncomment to test:
test_extraction()



def parse_urinalysis(text: str, filename: str) -> Dict:
    print("===== RAW PDF TEXT =====")
    print(text)
    gender, age = extract_gender_age(text)

    return {
        # Patient Info
        "patientName": extract_patient_info(text, "Name"),
        "mrn": extract_patient_info(text, "MRN"),
        "gender": gender,
        "age": age,
        "dob": extract_patient_info(text, "DOB"),
        "collectionDateTime": extract_patient_info(text, "Collection Date/Time"),
        "resultValidated": extract_patient_info(text, "Result Validated"),
        "orderNumber": extract_patient_info(text, "Order Number"),
        "location": extract_patient_info(text, "Location"),

        # Urinalysis Fields (Match CBC format)
        "color": extract_urinalysis_value(text, "Color"),
        "clarity": extract_urinalysis_value(text, "Clarity"),
        "glucose": extract_urinalysis_value(text, "Glucose"),
        "bilirubin": extract_urinalysis_value(text, "Bilirubin"),
        "ketones": extract_urinalysis_value(text, "Ketones"),
        "specific_gravity": extract_urinalysis_value(text, "Specific Gravity"),
        "blood": extract_urinalysis_value(text, "Blood"),
        "ph": extract_urinalysis_value(text, "PH"),
        "protein": extract_urinalysis_value(text, "Protein"),
        "urobilinogen": extract_urinalysis_value(text, "Urobilinogen"),
        "nitrite": extract_urinalysis_value(text, "Nitrite"),
        "leukocyte_esterase": extract_urinalysis_value(text, "Leukocyte Esterase"),
        "rbc": extract_urinalysis_value(text, "RBC"),
        "wbc": extract_urinalysis_value(text, "WBC"),
        "epithelial_cells": extract_urinalysis_value(text, "Epithelial Cells"),
        "bacteria": extract_urinalysis_value(text, "Bacteria"),
        "hyaline_cast": extract_urinalysis_value(text, "Hyaline Cast"),
        "remarks": extract_urinalysis_value(text, "Remarks:"),

        # Meta
        "fileName": filename,
        "uploadDate": datetime.utcnow().isoformat(),
        "uniqueId": filename.replace(".pdf", "")
    }
@app.post("/extract-ecg")
async def extract_ecg(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        pdf = fitz.open(stream=contents, filetype="pdf")
        text = "".join([page.get_text() for page in pdf])
        pdf.close()

        # Debug print
        print("Extracted ECG text:\n", text)

        data = parse_ecg_data(text, file.filename)

        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing ECG file: {str(e)}")


def parse_ecg_data(text: str, filename: str) -> Dict:
    def extract(pattern, default=""):
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE | re.DOTALL)
        return match.group(1).strip() if match and match.group(1) else default

    extracted_data = {
        "pidNo": extract(r"PID\s*No\s*[:\-]?\s*(\d+)"),
        "date": extract(r"Date\s*[:\-]?\s*([0-9]{1,2}-[A-Z]{3}-[0-9]{4})"),
        "patientName": extract(r"Patient(?:'|')?s\s*Name\s*[:\-]?\s*([A-Z ]+)"),
        "referringPhysician": extract(r"Referring\s*Physician\s*[:\-]?\s*([A-Z ]+)\s+Birth"),
        "hr": extract(r"HR\s*[:\-]?\s*(\d+\s*bpm)"),
        "bp": extract(r"BP\s*[:\-]?\s*([\d]+\/[\d]+\s*mmHg)"),
        "age": extract(r"Age/Sex\s*[:\-]?\s*(\d+)"),
        "sex": extract(r"Age/Sex\s*[:\-]?\s*\d+\/([MF])"),
        "birthDate": extract(r"Birth\s*date\s*[:\-]?\s*([0-9]{2}-[A-Z]{3}-[0-9]{4})"),
        "qrs": extract(r"\bQRS\s+(\d+\s*ms)"),
        "qtQtc": extract(r"\bQT/QTcBaZ\s+([\d]+\/[\d]+\s*ms)"),
        "pr": extract(r"\bPR\s+(\d+\s*ms)"),
        "pWave": extract(r"^\s*P\s+(\d+\s*ms)", default=""),
        "rrPp": extract(r"RR/PP\s+([\d]+\/[\d]+\s*ms)"),
        "pqrstAxis": extract(r"P/QRS/T\s+([\d\-\/\s]+)\s*degrees"),
        "interpretation": extract(r"INTERPRETATION\s*[:\-]?\s*\n?\s*([^A-Z\n]*(?:[a-z][^A-Z\n]*)*?)(?=\s+[A-Z]{2,}(?:\s+[A-Z]+)*\s*,?\s*(?:MD|CARDIOLOGIST)|$)"),

        # Metadata
        "fileName": filename,
        "uploadDate": datetime.utcnow().isoformat(),
        "uniqueId": filename.replace(".pdf", "")
    }


    # Clean string values
    for key, value in extracted_data.items():
        if isinstance(value, str) and key not in ["fileName", "uploadDate", "uniqueId"]:
            extracted_data[key] = re.sub(r'\s+', ' ', value).strip()

    return extracted_data
    
@app.post("/extract-lipid-profile")
async def extract_lipid_profile(file: UploadFile = File(...)) -> Dict:
    try:
        content = await file.read()
        pdf = fitz.open(stream=content, filetype="pdf")
        text = "".join(page.get_text() for page in pdf)
        pdf.close()

        # Parse data only — no file writing here
        result = parse_lipid_profile(text, file.filename)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract lipid data: {str(e)}")


def extract_patient_info(text: str, label: str, fallback: str = "") -> str:
    """Extract patient information from PDF text"""
    match = re.search(rf"{re.escape(label)}\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
    return match.group(1).strip() if match else fallback

def extract_gender_age(text: str):
    """Extract gender and age from the PDF text"""
    match = re.search(r"Gender\s*/\s*Age\s*[:\-]?\s*(\w+)\s*/\s*(.+)", text)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return "", ""

def extract_lipid_value(text: str, test_name: str):
    """
    Enhanced extraction that handles different PDF formats and flag positions.
    """
    print(f"Looking for test: {test_name}")
    
    # Clean the text for better matching
    cleaned_text = re.sub(r'\s+', ' ', text.strip())
    
    # Handle ALT/SGPT (can appear anywhere in the document)
    if test_name.lower() in ["alt/sgpt", "alt", "sgpt"]:
        patterns = [
            # Pattern 1: ALT/SGPT 21.0 U/L 4.0 - 36.0
            r"ALT/SGPT\s+([HLN])?\s*([\d.]+)\s+(U/L)\s+([\d.]+ - [\d.]+)",
            # Pattern 2: ALT 13.0 U/L 4.0 - 36.0 (without /SGPT)
            r"(?<!/)ALT(?!/)\s+([HLN])?\s*([\d.]+)\s+(U/L)\s+([\d.]+ - [\d.]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 4:  # Has flag
                    return {
                        "result": groups[1],
                        "unit": groups[2],
                        "reference_range": groups[3],
                        "flag": groups[0] if groups[0] else ""
                    }
                else:  # No flag
                    return {
                        "result": groups[0],
                        "unit": groups[1],
                        "reference_range": groups[2],
                        "flag": ""
                    }
    
    # Handle Cholesterol (Total) - more flexible pattern
    if test_name.lower() in ["cholesterol (total)", "total cholesterol", "cholesterol"]:
        patterns = [
            # Pattern 1: Cholesterol (Total) L 138.00 mg/dL 150 - 200
            r"Cholesterol\s*\(Total\)\s+([HLN])\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
            # Pattern 2: Cholesterol (Total) 165.00 mg/dL 150 - 200 (no flag)
            r"Cholesterol\s*\(Total\)\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 4:  # Has flag
                    return {
                        "result": groups[1],
                        "unit": groups[2],
                        "reference_range": groups[3],
                        "flag": groups[0]
                    }
                else:  # No flag
                    return {
                        "result": groups[0],
                        "unit": groups[1],
                        "reference_range": groups[2],
                        "flag": ""
                    }
    
    # Handle Triglycerides
    if test_name.lower() == "triglycerides":
        patterns = [
            r"Triglycerides\s+([HLN])\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
            r"Triglycerides\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 4:  # Has flag
                    return {
                        "result": groups[1],
                        "unit": groups[2],
                        "reference_range": groups[3],
                        "flag": groups[0]
                    }
                else:  # No flag
                    return {
                        "result": groups[0],
                        "unit": groups[1],
                        "reference_range": groups[2],
                        "flag": ""
                    }
    
    # Handle Cholesterol HDL
    if test_name.lower() in ["cholesterol hdl", "hdl", "hdl cholesterol"]:
        patterns = [
            # Pattern 1: Cholesterol HDL H 84.0 mg/dL 40.0 - 75.0
            r"Cholesterol HDL\s+([HLN])\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
            # Pattern 2: Cholesterol HDL 54.0 mg/dL 40.0 - 75.0 (no flag)
            r"Cholesterol HDL\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 4:  # Has flag
                    return {
                        "result": groups[1],
                        "unit": groups[2],
                        "reference_range": groups[3],
                        "flag": groups[0]
                    }
                else:  # No flag
                    return {
                        "result": groups[0],
                        "unit": groups[1],
                        "reference_range": groups[2],
                        "flag": ""
                    }
    
    # Handle Cholesterol LDL
    if test_name.lower() in ["cholesterol ldl", "ldl", "ldl cholesterol"]:
        patterns = [
            r"Cholesterol LDL\s+([HLN])\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
            r"Cholesterol LDL\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 4:  # Has flag
                    return {
                        "result": groups[1],
                        "unit": groups[2],
                        "reference_range": groups[3],
                        "flag": groups[0]
                    }
                else:  # No flag
                    return {
                        "result": groups[0],
                        "unit": groups[1],
                        "reference_range": groups[2],
                        "flag": ""
                    }
    
    # Handle VLDL
    if test_name.lower() == "vldl":
        patterns = [
            # Pattern 1: VLDL L 13.60 mg/dL 20 - 30
            r"VLDL\s+([HLN])\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
            # Pattern 2: VLDL 19.80 mg/dL 20 - 30 (no flag)
            r"VLDL\s+([\d.]+)\s+(mg/dL)\s+([\d.]+ - [\d.]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 4:  # Has flag
                    return {
                        "result": groups[1],
                        "unit": groups[2],
                        "reference_range": groups[3],
                        "flag": groups[0]
                    }
                else:  # No flag
                    return {
                        "result": groups[0],
                        "unit": groups[1],
                        "reference_range": groups[2],
                        "flag": ""
                    }
    
    # Default empty structure
    return {
        "result": "",
        "unit": "",
        "reference_range": "",
        "flag": ""
    }

def parse_lipid_profile(text: str, filename: str) -> Dict:
    """Parse the lipid profile PDF and extract all relevant information"""
    print("===== RAW PDF TEXT =====")
    print(text)
    print("=" * 50)
    
    gender, age = extract_gender_age(text)

    result = {
        # Patient Info
        "patientName": extract_patient_info(text, "Name"),
        "mrn": extract_patient_info(text, "MRN"),
        "gender": gender,
        "age": age,
        "dob": extract_patient_info(text, "DOB"),
        "collectionDateTime": extract_patient_info(text, "Collection Date/Time"),
        "resultValidated": extract_patient_info(text, "Result Validated"),
        "location": extract_patient_info(text, "Location"),

        # Lipid Profile Fields
        "alt_sgpt": extract_lipid_value(text, "ALT/SGPT"),
        "total_cholesterol": extract_lipid_value(text, "Cholesterol (Total)"),
        "triglycerides": extract_lipid_value(text, "Triglycerides"),
        "hdl_cholesterol": extract_lipid_value(text, "Cholesterol HDL"),
        "ldl_cholesterol": extract_lipid_value(text, "Cholesterol LDL"),
        "vldl": extract_lipid_value(text, "VLDL"),

        # Meta
        "fileName": filename,
        "uploadDate": datetime.utcnow().isoformat(),
        "uniqueId": filename.replace(".pdf", "")
    }
    
    # Debug: Print extracted values
    print("===== EXTRACTED VALUES =====")
    for key, value in result.items():
        if isinstance(value, dict) and 'result' in value:
            print(f"{key}: {value}")
    print("=" * 50)
    
    return result

# Test function with your actual data
def test_with_actual_data():
    """Test with the actual PDF data from your documents"""
    
    # First PDF data (GARCES)
    pdf_text_1 = """TEST Result Unit Biological Reference Range
Lipid Profile
Cholesterol (Total) L 138.00 mg/dL 150 - 200
Triglycerides 99.00 mg/dL 10 - 190
Cholesterol HDL 54.0 mg/dL 40.0 - 75.0
Cholesterol LDL 64.2 mg/dL 50 - 130
VLDL L 19.80 mg/dL 20 - 30
ALT/SGPT 13.0 U/L 4.0 - 36.0"""
    
    # Second PDF data (RADEN)
    pdf_text_2 = """TEST Result Unit Biological Reference Range
ALT/SGPT 21.0 U/L 4.0 - 36.0
Lipid Profile
Cholesterol (Total) 165.00 mg/dL 150 - 200
Triglycerides 68.00 mg/dL 10 - 190
Cholesterol HDL H 84.0 mg/dL 40.0 - 75.0
Cholesterol LDL 67.4 mg/dL 50 - 130
VLDL L 13.60 mg/dL 20 - 30"""
    
    print("=== TESTING FIRST PDF (GARCES) ===")
    result1 = parse_lipid_profile(pdf_text_1, "GARCES.pdf")
    
    print("\n=== TESTING SECOND PDF (RADEN) ===")
    result2 = parse_lipid_profile(pdf_text_2, "RADEN.pdf")

# Uncomment to test:
# test_with_actual_data()

@app.post("/extract-medical-exam")
async def extract_medical_exam(file: UploadFile = File(...)) -> Dict:
    try:
        content = await file.read()
        pdf = fitz.open(stream=content, filetype="pdf")
        text = "".join(page.get_text() for page in pdf)
        pdf.close()

        result = parse_medical_exam(text, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract medical exam data: {str(e)}")


def parse_medical_exam(text: str, filename: str) -> Dict:
    from datetime import datetime
    import re

    print("===== RAW MEDICAL EXAM TEXT =====")
    print(text)
    print("=" * 50)

    def extract_field(pattern, default=""):
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        try:
            result = match.group(1).strip()
            print(f"[FIELD MATCH] {pattern} → {result}")
            return result
        except (AttributeError, IndexError):
            print(f"[FIELD MISSING] {pattern} → DEFAULT: {default}")
            return default

    def extract_yes_no_condition(condition_name):
        pattern = rf"\[([✓xX ])\]\s*{re.escape(condition_name)}"
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            return "UNKNOWN"
        symbol = match.group(1)
        return "YES" if symbol.strip() in ["✓", "x", "X"] else "NO"

    def detect_checkbox_status(text_section, keywords):
        for keyword in keywords:
            pattern = rf"([✓xX\s])\s*{re.escape(keyword)}|{re.escape(keyword)}\s*([✓xX\s])"
            match = re.search(pattern, text_section, re.IGNORECASE)
            if match:
                checkbox = (match.group(1) or match.group(2) or "").strip()
                if checkbox in ["✓", "x", "X"]:
                    return keyword.upper()
        return "NOT_FOUND"

    def extract_vital_signs():
        return {
            "blood_pressure": re.search(r"Blood Pressure.*?(\d+/\d+)", text, re.IGNORECASE | re.DOTALL).group(1) if re.search(r"Blood Pressure.*?(\d+/\d+)", text, re.IGNORECASE | re.DOTALL) else "",
            "pulse": re.search(r"Pulse.*?(\d+)", text, re.IGNORECASE | re.DOTALL).group(1) if re.search(r"Pulse.*?(\d+)", text, re.IGNORECASE | re.DOTALL) else "",
            "spo2": re.search(r"Spo02.*?(\d+)", text, re.IGNORECASE | re.DOTALL).group(1) if re.search(r"Spo02.*?(\d+)", text, re.IGNORECASE | re.DOTALL) else "",
            "respiratory_rate": re.search(r"Res.*?(\d+)", text, re.IGNORECASE | re.DOTALL).group(1) if re.search(r"Res.*?(\d+)", text, re.IGNORECASE | re.DOTALL) else "",
            "temperature": re.search(r"TEMP.*?([\d.]+)", text, re.IGNORECASE | re.DOTALL).group(1) if re.search(r"TEMP.*?([\d.]+)", text, re.IGNORECASE | re.DOTALL) else "",
        }

    def extract_anthropometrics():
        return {
            "height": re.search(r"HEIGHT:.*?(\d+)", text, re.IGNORECASE).group(1) if re.search(r"HEIGHT:.*?(\d+)", text, re.IGNORECASE) else "",
            "weight": re.search(r"WEIGHT:.*?([\d.]+)", text, re.IGNORECASE).group(1) if re.search(r"WEIGHT:.*?([\d.]+)", text, re.IGNORECASE) else "",
            "bmi": re.search(r"BMI:\s*([\d.]+)", text, re.IGNORECASE).group(1) if re.search(r"BMI:\s*([\d.]+)", text, re.IGNORECASE) else "",
            "ibw": re.search(r"IBW:.*?([\d.]+)", text, re.IGNORECASE).group(1) if re.search(r"IBW:.*?([\d.]+)", text, re.IGNORECASE) else "",
        }

    def extract_visual_acuity():
        return {
            "vision_adequacy": re.search(r"ADEQUATE:\s*([A-Z]+)", text, re.IGNORECASE).group(1) if re.search(r"ADEQUATE:\s*([A-Z]+)", text, re.IGNORECASE) else "",
            "od": re.search(r"OD=([J\d]+)", text).group(1) if re.search(r"OD=([J\d]+)", text) else "",
            "os": re.search(r"OS=([J\d]+)", text).group(1) if re.search(r"OS=([J\d]+)", text) else "",
        }

    def extract_lab_findings():
        return {
            "cbc": re.search(r"Complete Blood Count\s+(Unremarkable|[A-Za-z\s]+)", text, re.IGNORECASE).group(1).strip() if re.search(r"Complete Blood Count\s+(Unremarkable|[A-Za-z\s]+)", text, re.IGNORECASE) else "",
            "urinalysis": re.search(r"Urinalys\s+(Unremarkable|[A-Za-z\s]+)", text, re.IGNORECASE).group(1).strip() if re.search(r"Urinalys\s+(Unremarkable|[A-Za-z\s]+)", text, re.IGNORECASE) else "",
            "blood_chemistry": re.search(r"Blood Chemistry\s+(Unremarkable|[A-Za-z\s]+)", text, re.IGNORECASE).group(1).strip() if re.search(r"Blood Chemistry\s+(Unremarkable|[A-Za-z\s]+)", text, re.IGNORECASE) else "",
            "chest_xray": re.search(r"Chest X-ray\s+([A-Za-z\s]+?)(?=PA LORDOTIC|ECG|\n)", text, re.IGNORECASE).group(1).strip() if re.search(r"Chest X-ray\s+([A-Za-z\s]+?)(?=PA LORDOTIC|ECG|\n)", text, re.IGNORECASE) else "",
            "ecg": re.search(r"ECG\s+(Unremarkable|[A-Za-z\s]+)", text, re.IGNORECASE).group(1).strip() if re.search(r"ECG\s+(Unremarkable|[A-Za-z\s]+)", text, re.IGNORECASE) else "",
        }

    def extract_medical_classification():
        classification = {}

        # Detect FIT / UNFIT using checkboxes
        fit_section = re.search(r"RECOMMENDATIONS:(.*?)\n", text, re.IGNORECASE | re.DOTALL)
        classification["fitness_status"] = detect_checkbox_status(fit_section.group(1), ["FIT", "UNFIT"]) if fit_section else ""

        # Detect Medical Class using checkboxes
        class_section = re.search(r"Class\s*([A-E]|PENDING)[\s\S]{0,50}", text, re.IGNORECASE)
        classification["medical_class"] = detect_checkbox_status(class_section.group(0), ["A", "B", "C", "D", "E", "PENDING"]) if class_section else ""

        # Extract needs treatment
        treatment = re.search(r"Needs\s+treatment/?\s*correction\s+([A-Z\s,\-]+?)(?=Treatment\s+optional|Remarks|Date|$)", text, re.IGNORECASE)
        classification["needs_treatment"] = treatment.group(1).strip() if treatment else ""

        # Extract remarks
        remarks = re.search(r"Remarks:\s+([a-zA-Z\s,\-\.]+?)(?=Date\s+of\s+Initial|This\s+is\s+to\s+certify|$)", text, re.IGNORECASE)
        classification["remarks"] = remarks.group(1).strip() if remarks else ""

        return classification

    vitals = extract_vital_signs()
    anthro = extract_anthropometrics()
    visual = extract_visual_acuity()
    labs = extract_lab_findings()
    classification = extract_medical_classification()

    yes_no_conditions = {
        "head_or_neck_injury": extract_yes_no_condition("Head or Neck Injury"),
        "frequent_dizziness": extract_yes_no_condition("Frequent Dizziness"),
        "fainting_spells": extract_yes_no_condition("Fainting Spells"),
        "chronic_cough": extract_yes_no_condition("Chronic Cough"),
        "heart_disease": extract_yes_no_condition("Heart Disease/ Chest Pain"),
        "hypertension": extract_yes_no_condition("Hypertension"),
        "diabetes": extract_yes_no_condition("Diabetes"),
        "asthma": extract_yes_no_condition("Asthma"),
        "epilepsy": extract_yes_no_condition("Epilepsy"),
        "mental_disorder": extract_yes_no_condition("Mental Disorder"),
        "tuberculosis": extract_yes_no_condition("Tuberculosis"),
        "cancer": extract_yes_no_condition("Cancer"),
        "kidney_disease": extract_yes_no_condition("Kidney Disease"),
        "others": extract_yes_no_condition("Others")
    }

    return {
        "patient_name": extract_field(r"PATIENT NAME:\s*([A-Z\s]+)\s+PID:"),
        "pid": extract_field(r"PID:\s*(\d+)"),
        "date_of_birth": extract_field(r"DATE OF BIRTH:\s*([\d/]+)"),
        "age": int(extract_field(r"AGE:\s*(\d+)", "0")),
        "sex": extract_field(r"SEX:\s*([A-Z]+)"),
        "date_of_examination": extract_field(r"DATE OF.*?(\d{2}\s+\d{2}\s+\d{4})"),
        "civil_status": extract_field(r"CIVIL STATUS:\s*([A-Z]+)"),
        "company": extract_field(r"COMPANY:\s*([A-Z\s]+)\s+OCCUPATION:"),
        "occupation": extract_field(r"OCCUPATION:\s*([A-Z\s]*)", ""),

        "present_illness": extract_field(r"PRESENT ILLNESS:\s*([A-Z\s]*)\s+ALLERGY:"),
        "food_allergy": extract_field(r"Food:\s*([A-Z]+)"),
        "medication_allergy": extract_field(r"Medication:\s*([A-Z]+)"),
        "past_consultation": extract_field(r"If YES, specify:\s*([A-Z\d\s-]+)"),
        "maintenance_medications": extract_field(r"If YES, specify:\s*([A-Z\s\d]+)"),
        "previous_hospitalizations": extract_field(r"Previous Hospitalizations:\s*([A-Z\s,\d-]+)"),

        "menstrual_history_lmp": extract_field(r"LMP\s*:\s*([A-Z\s\d]+)"),
        "obstetrical_history": extract_field(r"OBSTETRICAL HISTORY:\s*([A-Z\d\s()]+)"),

        **vitals,
        **anthro,
        **visual,
        **labs,
        **classification,

        "examining_physician": extract_field(r"KRIZIA KATE LANUTAN LIAO\s+([A-Z\s]+)\s+DR\."),
        "evaluating_personnel": extract_field(r"DR\.\s+([A-Z\s-]+)"),
        "physician_prc": extract_field(r"PRC#:\s*(\d+)"),

        "date_of_initial_peme": extract_field(r"Date of Initial PEME:\s*([\d/]+)"),
        "date_of_fitness": extract_field(r"Date of Fitness:\s*([\d/]*)"),
        "valid_until": extract_field(r"Valid Until:\s*([\d/]*)"),

        "fileName": filename,
        "uploadDate": datetime.utcnow().isoformat(),
        "uniqueId": filename.replace(".pdf", ""),

        **yes_no_conditions
    }



@app.post("/extract-chem")
async def extract_chem(file: UploadFile = File(...)) -> Dict:
    try:
        content = await file.read()
        pdf = fitz.open(stream=content, filetype="pdf")
        text = "\n".join(page.get_text() for page in pdf)
        pdf.close()

        result = parse_chemistry(text, file.filename)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting Chemistry data: {str(e)}")

def parse_chemistry(text: str, filename: str) -> Dict:
    def extract(pattern, default=None):
        match = re.search(pattern, text, re.IGNORECASE)
        return match.group(1).strip() if match else default

    # Header info
    name = extract(r"NAME\s*:\s*(.+)")
    mrn = extract(r"MRN\s*:\s*(.+)")
    gender = extract(r"GENDER\s*:\s*(\w+)")
    age = extract(r"AGE\s*:\s*(\d+)")
    care_provider = extract(r"CARE\s*PROVIDER\s*:\s*(.+)")
    location = extract(r"LOCATION\s*:\s*(.+)")
    dob = extract(r"DATE\s*OF\s*BIRTH\s*:\s*(.+)")
    collection_dt = extract(r"COLLECTION\s*DATE/TIME\s*:\s*(.+)")
    validated = extract(r"RESULT\s*VALIDATED\s*:\s*(.+)")

    # Extract test result rows (tabular)
    tests = []
    pattern = re.compile(
        r"(?P<test>[A-Z0-9 \-\/().]+?)\s+(?P<result>[\d.]+)\s+(?P<unit>[\w/%μ·]+)\s+(?P<ref>[<>]=?\s*[\d.]+(?:\s*-\s*[\d.]+)?(?:\s*[\w/%μ·]+)?)",
        re.MULTILINE | re.IGNORECASE
    )

    for match in pattern.finditer(text):
        tests.append({
            "test_name": match.group("test").strip(),
            "result": match.group("result").strip(),
            "unit": match.group("unit").strip(),
            "reference_range": match.group("ref").strip(),
        })

    # Also extract known chemistry values (optional structured view)
    lab_data = {
        "fbs": extract(r"FBS\s*[:\-]?\s*([\d.]+)"),
        "bua": extract(r"(?:BUA|URIC ACID)\s*[:\-]?\s*([\d.]+)"),
        "creatinine": extract(r"CREATININE\s*[:\-]?\s*([\d.]+)"),
        "sgpt": extract(r"(?:ALT|SGPT)\s*[:\-]?\s*([\d.]+)"),
        "cholesterol": extract(r"CHOLESTEROL\s*[:\-]?\s*([\d.]+)"),
        "hdl": extract(r"HDL\s*[:\-]?\s*([\d.]+)"),
        "ldl": extract(r"LDL\s*[:\-]?\s*([\d.]+)"),
        "triglycerides": extract(r"TRIGLYCERIDES\s*[:\-]?\s*([\d.]+)")
    }

    return {
        "uniqueId": filename.replace(".pdf", ""),
        "fileName": filename,
        "uploadDate": datetime.utcnow().isoformat(),
        "name": name,
        "mrn": mrn,
        "gender": gender,
        "age": age,
        "care_provider": care_provider,
        "location": location,
        "dob": dob,
        "collection_datetime": collection_dt,
        "result_validated": validated,
        "test_results": tests,
        **lab_data  # Merges structured fields
    }
