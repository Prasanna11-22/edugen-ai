import base64
import numpy as np
import cv2
import torch

_yolo_model = None

# Violation Weights Configuration
WEIGHT_PHONE = 4              # Mobile = 4
WEIGHT_LAPTOP = 3             # Laptop = 3
WEIGHT_MULTIPLE_PERSONS = 2   # Multiple Persons = 2
WEIGHT_TAB_SWITCH = 5         # Tab Switch = 5
WEIGHT_NO_PERSON = 0          # No person = 0 (Blinking warning only, no flag increment)
MAX_PROCTOR_FLAGS = 50

def get_yolo_model():
    """
    Lazy loads and caches the YOLOv8 nano model for fast sub-25ms inference.
    """
    global _yolo_model
    if _yolo_model is None:
        try:
            from ultralytics import YOLO
            _yolo_model = YOLO("yolov8n.pt")
            print("[Proctor] YOLOv8 Model loaded successfully for multi-object proctoring (person, phone, laptop).")
        except Exception as e:
            print(f"[Proctor] Ultralytics YOLOv8 loading note: {e}")
            _yolo_model = False
    return _yolo_model


def decode_base64_image(image_b64: str):
    """
    Decodes a base64 JPEG/PNG string to an OpenCV BGR numpy array.
    """
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    
    img_bytes = base64.b64decode(image_b64)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img


def analyze_proctor_frame(image_b64: str) -> dict:
    """
    High-speed, sensitive multi-object proctoring frame analyzer using YOLOv8.
    Detects:
      - Class 0: 'person' (Multiple persons or absence)
      - Class 67: 'cell phone' (Unauthorized mobile phone)
      - Class 63 / 62: 'laptop' / 'tv/monitor' (Unauthorized secondary laptop / display screen)
    """
    try:
        img = decode_base64_image(image_b64)
        if img is None:
            return {
                "person_count": 1,
                "phone_count": 0,
                "laptop_count": 0,
                "is_multiple_persons": False,
                "is_phone_detected": False,
                "is_laptop_detected": False,
                "is_no_person": False,
                "violation": False,
                "violations": [],
                "added_flags": 0,
                "message": "Empty frame received"
            }
        
        model = get_yolo_model()
        person_count = 0
        phone_count = 0
        laptop_count = 0
        
        if model:
            # Classes: 0: person, 62: tv/screen, 63: laptop, 67: cell phone
            # conf=0.20 and imgsz=384 ensure fast and highly sensitive detection for mobile phones & laptops
            with torch.inference_mode():
                results = model.predict(
                    source=img,
                    classes=[0, 62, 63, 67],
                    imgsz=384,
                    conf=0.20,
                    verbose=False
                )
            
            if results and len(results) > 0 and results[0].boxes is not None:
                cls_list = results[0].boxes.cls.int().tolist()
                person_count = cls_list.count(0)
                # Count laptops and external screens/monitors
                laptop_count = cls_list.count(63) + cls_list.count(62)
                phone_count = cls_list.count(67)
        else:
            # Fast Haar Cascade fallback for face detection if model failed to load
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=4, minSize=(30, 30))
            person_count = len(faces)

        is_multiple_persons = person_count > 1
        is_phone_detected = phone_count > 0
        is_laptop_detected = laptop_count > 0
        is_no_person = person_count == 0

        violations = []
        added_flags = 0

        if is_phone_detected:
            violations.append({
                "type": "cell_phone",
                "label": f"Unauthorized Mobile Phone Detected ({phone_count})",
                "weight": WEIGHT_PHONE
            })
            added_flags += WEIGHT_PHONE

        if is_laptop_detected:
            violations.append({
                "type": "laptop",
                "label": f"Unauthorized Laptop / Display Detected ({laptop_count})",
                "weight": WEIGHT_LAPTOP
            })
            added_flags += WEIGHT_LAPTOP

        if is_multiple_persons:
            violations.append({
                "type": "multiple_persons",
                "label": f"Multiple Persons Detected ({person_count} persons)",
                "weight": WEIGHT_MULTIPLE_PERSONS
            })
            added_flags += WEIGHT_MULTIPLE_PERSONS

        violation = len(violations) > 0

        # Construct concise status message
        if violations:
            msg_parts = [v["label"] for v in violations]
            message = " | ".join(msg_parts)
        elif is_no_person:
            message = "No test-taker detected in camera view."
        else:
            message = "Normal: Single test-taker confirmed, no unauthorized devices."

        return {
            "person_count": person_count,
            "phone_count": phone_count,
            "laptop_count": laptop_count,
            "is_multiple_persons": is_multiple_persons,
            "is_phone_detected": is_phone_detected,
            "is_laptop_detected": is_laptop_detected,
            "is_no_person": is_no_person,
            "violation": violation,
            "violations": violations,
            "added_flags": added_flags,
            "message": message,
            "weights": {
                "cell_phone": WEIGHT_PHONE,
                "laptop": WEIGHT_LAPTOP,
                "multiple_persons": WEIGHT_MULTIPLE_PERSONS,
                "tab_switch": WEIGHT_TAB_SWITCH,
                "no_person": WEIGHT_NO_PERSON,
                "max_flags": MAX_PROCTOR_FLAGS
            }
        }
    except Exception as e:
        print(f"[Proctor] Frame analysis error: {e}")
        return {
            "person_count": 1,
            "phone_count": 0,
            "laptop_count": 0,
            "is_multiple_persons": False,
            "is_phone_detected": False,
            "is_laptop_detected": False,
            "is_no_person": False,
            "violation": False,
            "violations": [],
            "added_flags": 0,
            "message": f"Processing note: {str(e)}",
            "weights": {
                "cell_phone": WEIGHT_PHONE,
                "laptop": WEIGHT_LAPTOP,
                "multiple_persons": WEIGHT_MULTIPLE_PERSONS,
                "tab_switch": WEIGHT_TAB_SWITCH,
                "no_person": WEIGHT_NO_PERSON,
                "max_flags": MAX_PROCTOR_FLAGS
            }
        }
