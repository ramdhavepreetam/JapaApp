import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, ButtonBase } from '@mui/material';
import { SUPPORTED_LANGUAGES } from '../i18n';

export const LanguageToggle: React.FC = () => {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('hi') ? 'hi' : 'en';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        border: '1.5px solid',
        borderColor: 'primary.main',
        borderRadius: '20px',
        overflow: 'hidden',
      }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = current === lang.code;
        return (
          <ButtonBase
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            sx={{
              px: 1.5,
              py: 0.4,
              fontSize: '0.8rem',
              fontWeight: active ? 700 : 400,
              fontFamily: lang.code === 'hi' ? '"Noto Sans Devanagari", sans-serif' : 'inherit',
              bgcolor: active ? 'primary.main' : 'transparent',
              color: active ? '#fff' : 'primary.main',
              transition: 'all 0.2s',
              lineHeight: 1.4,
            }}
          >
            {lang.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
};
