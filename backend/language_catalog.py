SUPPORTED_LANGUAGES = [
    # Indian
    {"code": "en", "name": "English", "group": "Indian"},
    {"code": "hi", "name": "Hindi", "group": "Indian"},
    {"code": "bn", "name": "Bengali", "group": "Indian"},
    {"code": "te", "name": "Telugu", "group": "Indian"},
    {"code": "mr", "name": "Marathi", "group": "Indian"},
    {"code": "ta", "name": "Tamil", "group": "Indian"},
    {"code": "ur", "name": "Urdu", "group": "Indian"},
    {"code": "gu", "name": "Gujarati", "group": "Indian"},
    {"code": "pa", "name": "Punjabi", "group": "Indian"},
    {"code": "sa", "name": "Sanskrit", "group": "Indian"},
    
    # International
    {"code": "zh-TW", "name": "Chinese (Traditional)", "group": "International"},
    {"code": "zh-CN", "name": "Chinese (Simplified)", "group": "International"},
    {"code": "fr", "name": "French", "group": "International"},
    {"code": "de", "name": "German", "group": "International"},
    {"code": "ru", "name": "Russian", "group": "International"},
    {"code": "ja", "name": "Japanese", "group": "International"},
    {"code": "ko", "name": "Korean", "group": "International"},
    {"code": "ar", "name": "Arabic", "group": "International"},
]

LANG_MAP = { lang['code']: lang['name'] for lang in SUPPORTED_LANGUAGES }
