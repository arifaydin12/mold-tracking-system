import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSelector = () => {
    const { i18n } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="flex gap-2">
            <button
                onClick={() => changeLanguage('tr')}
                className={`px-2 py-1 rounded text-xs font-bold ${i18n.language === 'tr' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
                TR
            </button>
            <button
                onClick={() => changeLanguage('en')}
                className={`px-2 py-1 rounded text-xs font-bold ${i18n.language === 'en' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
                EN
            </button>
            <button
                onClick={() => changeLanguage('de')}
                className={`px-2 py-1 rounded text-xs font-bold ${i18n.language === 'de' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
                DE
            </button>
        </div>
    );
};

export default LanguageSelector;
