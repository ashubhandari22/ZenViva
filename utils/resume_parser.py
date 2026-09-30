import os
import zipfile
import xml.etree.ElementTree as ET
import PyPDF2

def extract_text_from_pdf(file_path):
    """
    Reads a file (PDF, DOCX, or TXT) and extracts its text.
    Maintains backwards compatibility with existing callers.
    """
    return extract_resume_text(file_path)

def extract_resume_text(file_path):
    """
    Reads a document file based on its extension and extracts text.
    Supports PDF (.pdf), Word Documents (.docx), and plain text (.txt).
    """
    if not file_path or not os.path.exists(file_path):
        return ""
    
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        try:
            text = ""
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page_num in range(len(reader.pages)):
                    page = reader.pages[page_num]
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            return text.strip()
        except Exception as e:
            print(f"Error extracting text from PDF: {e}")
            return ""

    elif ext == '.docx':
        try:
            # DOCX is a zip archive containing word/document.xml
            text_parts = []
            with zipfile.ZipFile(file_path) as z:
                xml_content = z.read('word/document.xml')
                tree = ET.fromstring(xml_content)
                # WordprocessingML namespace
                namespace = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                for p in tree.iterfind('.//w:p', namespace):
                    texts = [node.text for node in p.iterfind('.//w:t', namespace) if node.text]
                    if texts:
                        text_parts.append(''.join(texts))
            return "\n".join(text_parts).strip()
        except Exception as e:
            print(f"Error extracting text from DOCX: {e}")
            return ""

    elif ext in ('.txt', '.text', '.md'):
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read().strip()
        except Exception as e:
            print(f"Error extracting text from TXT: {e}")
            return ""

    return ""

