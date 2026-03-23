import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, setLanguage, t as translate } from '../i18n';

const LANG_KEY = '@user_language';

interface LanguageContextValue {
  language: Language;
  setLang: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLang: async () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(saved => {
      if (saved === 'en' || saved === 'hi') {
        setLanguageState(saved);
        setLanguage(saved);
      }
    });
  }, []);

  const setLang = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    setLanguage(lang);
    await AsyncStorage.setItem(LANG_KEY, lang);
  }, []);

  const t = useCallback((key: string) => translate(key, language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
