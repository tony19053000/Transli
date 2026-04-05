"""
Text extraction utilities for document files.
Supports: .txt, .pdf, .docx
"""
import os


async def extract_text(file_path: str) -> str:
    """Detect file type by extension and extract text content."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".txt":
        return await extract_from_txt(file_path)
    elif ext == ".pdf":
        return await extract_from_pdf(file_path)
    elif ext == ".docx":
        return await extract_from_docx(file_path)
    elif ext in [".png", ".jpg", ".jpeg"]:
        return await extract_from_image(file_path)
    else:
        raise ValueError(f"Unsupported document type: {ext}")


async def extract_from_txt(file_path: str) -> str:
    """Read plain text files."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read().strip()


async def extract_from_pdf(file_path: str) -> str:
    """Extract text from PDF using PyPDF2."""
    from PyPDF2 import PdfReader

    reader = PdfReader(file_path)
    pages_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text.strip())
    
    result = "\n\n".join(pages_text)
    if not result:
        raise ValueError("PDF appears to contain no extractable text (may be scanned/image-based).")
    return result


async def extract_from_docx(file_path: str) -> str:
    """Extract text from DOCX using python-docx."""
    from docx import Document

    doc = Document(file_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    
    result = "\n".join(paragraphs)
    if not result:
        raise ValueError("DOCX appears to contain no text content.")
    return result


async def extract_from_image(file_path: str) -> str:
    """Extract text from images using pytesseract."""
    import pytesseract
    from PIL import Image, ImageOps, ImageFilter

    try:
        img = Image.open(file_path).convert("L")  # grayscale

        # Detect dark-background images (avg brightness < 128) and invert them
        avg = sum(img.getdata()) / (img.width * img.height)
        if avg < 128:
            img = ImageOps.invert(img)

        # Slight sharpening improves OCR on low-res or compressed images
        img = img.filter(ImageFilter.SHARPEN)

        text = pytesseract.image_to_string(img, config="--psm 6")

        result = text.strip()
        if not result:
            raise ValueError("No text could be extracted from this image. Ensure the image is clear and contains readable text.")
        return result
    except Exception as e:
        if isinstance(e, ValueError):
            raise e
        raise ValueError("Failed to process image for OCR. Ensure image is valid.")

