from fastapi import FastAPI, UploadFile, File
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
        # Try multiple patterns to handle different formats
        patterns = [
            rf"{re.escape(field)}\s*[:\-]?\s*(.+)",  # Original pattern with colon
            rf"{re.escape(field)}\s+(.+)",  # Pattern without colon (2023 format)
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return fallback

    def extract_gender_age():
        # Handle both formats:
        # 2025: separate Gender and Age fields
        # 2023: "Gender / Age : FEMALE / 56Y" format
        
        # Try 2023 format first
        match_2023 = re.search(r"Gender\s*/\s*Age\s*[:\-]?\s*(\w+)\s*/\s*(\d+)", text, re.IGNORECASE)
        if match_2023:
            return match_2023.group(1), int(match_2023.group(2))
        
        # Try 2025 format
        gender_match = re.search(r"Gender\s*[:\-]?\s*(\w+)", text, re.IGNORECASE)
        age_match = re.search(r"Age\s*[:\-]?\s*(\d+)", text, re.IGNORECASE)
        
        gender = gender_match.group(1) if gender_match else ""
        age = int(age_match.group(1)) if age_match else 0
        
        return gender, age

    def extract_name():
        # Handle both formats:
        # 2025: "Name: AMY A RADEN"
        # 2023: "Name    : Ms AMY ARAGON RADEN" or just "Name    Ms AMY ARAGON RADEN"
        
        patterns = [
            r"Name\s*[:\-]?\s*(.+?)(?=\s+MRN|\s+Location|\n|$)",  # Until MRN or Location
            r"Name\s+(.+?)(?=\s+MRN|\s+Location|\n|$)",  # Without colon
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    def extract_mrn():
        # Handle both formats
        patterns = [
            r"MRN\s*[:\-]?\s*(\d+)",
            r"MRN\s+(\d+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    def extract_dob():
        # Handle both formats:
        # 2025: "DOB: 11-01-1968"
        # 2023: "DOB    01-Nov-1968"
        
        patterns = [
            r"DOB\s*[:\-]?\s*([\d\-\w]+)",
            r"DOB\s+([\d\-\w]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    def extract_collection_datetime():
        # Handle both formats
        patterns = [
            r"Collection\s+Date\s*/\s*Time\s*[:\-]?\s*(.+?)(?=\n|\s+Result)",
            r"Collection\s+Date/Time\s*[:\-]?\s*(.+?)(?=\n|\s+Result)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    def extract_result_validated():
        # Handle both formats
        patterns = [
            r"Result\s+Validated\s*[:\-]?\s*(.+?)(?=\n|$)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""

    # Extract patient information using the improved functions
    gender, age = extract_gender_age()

    # Extract the WBC Absolute Count block
    absolute_count_block = extract_absolute_block(text)

    return {
        # Patient Info - using improved extraction functions
        "patientName": extract_name(),
        "mrn": extract_mrn(),
        "gender": gender,
        "age": age,
        "dob": extract_dob(),
        "collectionDateTime": extract_collection_datetime(),
        "resultValidated": extract_result_validated(),

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