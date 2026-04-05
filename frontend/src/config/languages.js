export const SUPPORTED_LANGUAGES = [
  // Indian Languages
  { code: 'en', name: 'English', group: 'Indian' },
  { code: 'hi', name: 'Hindi', group: 'Indian' },
  { code: 'bn', name: 'Bengali', group: 'Indian' },
  { code: 'te', name: 'Telugu', group: 'Indian' },
  { code: 'mr', name: 'Marathi', group: 'Indian' },
  { code: 'ta', name: 'Tamil', group: 'Indian' },
  { code: 'ur', name: 'Urdu', group: 'Indian' },
  { code: 'gu', name: 'Gujarati', group: 'Indian' },
  { code: 'pa', name: 'Punjabi', group: 'Indian' },
  { code: 'sa', name: 'Sanskrit', group: 'Indian' },

  // International Languages
  { code: 'zh-TW', name: 'Chinese (Traditional)', group: 'International' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', group: 'International' },
  { code: 'fr', name: 'French', group: 'International' },
  { code: 'de', name: 'German', group: 'International' },
  { code: 'ru', name: 'Russian', group: 'International' },
  { code: 'ja', name: 'Japanese', group: 'International' },
  { code: 'ko', name: 'Korean', group: 'International' },
  { code: 'ar', name: 'Arabic', group: 'International' }
];

export const INDIAN_LANGUAGES = SUPPORTED_LANGUAGES.filter(lang => lang.group === 'Indian');
export const INTERNATIONAL_LANGUAGES = SUPPORTED_LANGUAGES.filter(lang => lang.group === 'International');

export const getLanguageName = (code) => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code;
};
