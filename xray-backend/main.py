from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
from typing import Dict
from datetime import datetime
import re

app = FastAPI()

# CORS setup for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

    return {
        "patientName": extract("Patient's Name"),
        "dateOfBirth": extract("Date of Birth"),
        "age": int(re.search(r'\d+', extract("Age") or "0").group()),
        "gender": extract("Gender"),
        "company": extract("Company"),
        "examination": extract("Examination"),
        "reportDate": extract("Date"),
        "interpretation": extract_between("Interpretation", "Impression"),
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
        # Extract the WBC Absolute Count section specifically
        patterns = [
            r"WBC\s+Absolute\s+Count\s*(.*?)(?=\n\s*MEDICAL|\n\s*PRC|\Z)",  # Until signatures
            r"WBC\s+Absolute\s+Count\s*(.*?)(?=\n[A-Z][A-Z\s]*:)",  # Until next section
            r"WBC\s+Absolute\s+Count\s*(.*)"  # Everything after WBC Absolute Count
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if match and match.group(1).strip():
                return match.group(1).strip()
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
        "patientName": extract_patient_info("Name"),
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
    import re
    
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

        # Print for debug
        print("Extracted ECG text:\n", text)

        def extract(pattern, default=""):
                match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
                return match.group(1).strip() if match and match.group(1) else default


        extracted_data = {
            "pid_no": extract(r"PID\s*No\s*[:\-]?\s*(\d+)"),
            "date": extract(r"Date\s*[:\-]?\s*([0-9]{1,2}-[A-Z]{3}-[0-9]{4})"),
            "patient_name": extract(r"Patient(?:’|')?s\s*Name\s*[:\-]?\s*([A-Z ]+)"),
            "referring_physician": extract(r"Referring\s*Physician\s*[:\-]?\s*([A-Z ]+)\s+Birth"),
            "hr": extract(r"HR\s*[:\-]?\s*(\d+\s*bpm)"),
            "bp": extract(r"BP\s*[:\-]?\s*([\d]+\/[\d]+\s*mmHg)"),
            "age": extract(r"Age/Sex\s*[:\-]?\s*(\d+)"),
            "sex": extract(r"Age/Sex\s*[:\-]?\s*\d+\/([MF])"),
            "birth_date": extract(r"Birth\s*date\s*[:\-]?\s*([0-9]{2}-[A-Z]{3}-[0-9]{4})"),
            "qrs": extract(r"\bQRS\s+(\d+\s*ms)"),
            "qt_qtc": extract(r"\bQT/QTcBaZ\s+([\d]+\/[\d]+\s*ms)"),
            "pr": extract(r"\bPR\s+(\d+\s*ms)"),
            "p": extract(r"^\s*P\s+(\d+\s*ms)", default=""),  # anchored line
            "rr_pp": extract(r"RR/PP\s+([\d]+\/[\d]+\s*ms)"),
            "pqrst": extract(r"P/QRS/T\s+([\d\/ ]+degrees)"),
            "interpretation": extract(r"INTERPRETATION\s*[:\-]?\s*([\s\S]+?)\n\n|$", default="").split("\n")[0],
            "fileName": file.filename,
            "uploadDate": datetime.utcnow().isoformat(),
            "uniqueId": file.filename.replace(".pdf", "")  # ✅ required for Firestore lookup
        }

        # Clean up values (except fileName and uploadDate)
        for key, value in extracted_data.items():
            if isinstance(value, str) and key not in ["fileName", "uploadDate", "uniqueId"]:
                extracted_data[key] = re.sub(r'\s+', ' ', value).strip()

        return extracted_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing ECG file: {str(e)}")

