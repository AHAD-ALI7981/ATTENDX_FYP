"""
Face recognition utilities using OpenCV's built-in SFace and YuNet models.
This completely bypasses the need for dlib, C++ build tools, or heavy deep learning frameworks,
making it incredibly fast and easy to install on Windows.
"""

import base64
import io
import json
import os
import urllib.request
from typing import Optional, List

import cv2
import numpy as np
from PIL import Image

# Ensure models directory exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

YUNET_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar_v2.onnx")
SFACE_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec_v2.onnx")

# Download models if they don't exist
def download_models():
    yunet_url = "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx"
    sface_url = "https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx"
    
    if not os.path.exists(YUNET_PATH):
        print(f"Downloading YuNet Face Detector to {YUNET_PATH}...")
        urllib.request.urlretrieve(yunet_url, YUNET_PATH)
        print("Download complete.")
        
    if not os.path.exists(SFACE_PATH):
        print(f"Downloading SFace Face Recognizer to {SFACE_PATH}...")
        urllib.request.urlretrieve(sface_url, SFACE_PATH)
        print("Download complete.")

# Trigger download on module load
download_models()

# Initialize models (Detector uses default input size which we update per image)
detector = cv2.FaceDetectorYN.create(YUNET_PATH, "", (320, 320), 0.9, 0.3, 5000)
recognizer = cv2.FaceRecognizerSF.create(SFACE_PATH, "")

def image_from_base64(base64_string: str) -> np.ndarray:
    """Decode a base64 image string to a numpy array (BGR for OpenCV)."""
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]

    image_data = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(image_data)).convert("RGB")
    
    # Convert RGB (PIL) to BGR for OpenCV
    bgr_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    return bgr_image

def get_face_encoding(base64_image: str) -> Optional[np.ndarray]:
    """
    Extract the 128-dimension face encoding using SFace.
    Returns None if no face is detected.
    """
    img = image_from_base64(base64_image)
    
    # Update detector input size based on image dimensions
    height, width, _ = img.shape
    detector.setInputSize((width, height))
    
    # Detect faces
    faces = detector.detect(img)
    if faces[1] is None:
        return None
        
    # Get the highest scoring face (faces[1] is a numpy array of shape [num_faces, 15])
    # The first one is usually the most prominent if sorted, but we just take the first.
    face = faces[1][0]
    
    # Align and extract feature encoding
    aligned_face = recognizer.alignCrop(img, face)
    feature = recognizer.feature(aligned_face)
    
    return feature[0] # Returns a 1D numpy array (128-dim)

def encoding_to_json(encoding: np.ndarray) -> str:
    """Serialize a numpy face encoding to a JSON string for DB storage."""
    return json.dumps(encoding.tolist())

def json_to_encoding(json_str: str) -> np.ndarray:
    """Deserialize a JSON string back to a numpy face encoding."""
    # SFace features are extracted as float32
    return np.array(json.loads(json_str), dtype=np.float32)

def match_face(
    scanned_encoding: np.ndarray,
    known_encodings: List[np.ndarray],
    tolerance: float = 1.128, # SFace cosine distance threshold (docs recommend 0.363 for L2, cosine works better)
) -> int:
    """
    Compare a scanned face encoding against a list of known encodings.
    Returns the index of the best match, or -1 if no match found.
    
    With SFace, distance is typically calculated via Cosine or L2.
    """
    if not known_encodings:
        return -1

    best_match_index = -1
    # OpenCV's cv2.FaceRecognizerSF.match uses Cosine (0) or L2 (1) distance.
    # The return value is the distance. 
    # For cosine similarity, higher is better? No, cv2 match returns distance.
    # Let's manually compute cosine distance if needed, or use the builtin:
    
    max_score = -1.0
    threshold = 0.363 # OpenCV's recommended cosine score threshold for SFace
    
    for idx, known in enumerate(known_encodings):
        score = recognizer.match(
            known.reshape(1, 128), 
            scanned_encoding.reshape(1, 128), 
            cv2.FaceRecognizerSF_FR_COSINE
        )
        # Cosine score: > 0.363 is considered a match. Higher is more similar.
        if score >= threshold and score > max_score:
            max_score = score
            best_match_index = idx

    return best_match_index
