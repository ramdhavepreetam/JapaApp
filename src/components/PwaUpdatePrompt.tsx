import { useTranslation } from 'react-i18next';
import { Snackbar, Button, Box, Typography } from '@mui/material';
import { RotateCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PwaUpdatePrompt: React.FC = () => {
    const { t } = useTranslation();
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW();

    const handleDismiss = () => setNeedRefresh(false);
    const handleReload = () => updateServiceWorker(true);

    return (
        <Snackbar
            open={needRefresh}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            sx={{ zIndex: 1500 }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderRadius: 2,
                    boxShadow: 4,
                    px: 2,
                    py: 1.5,
                }}
            >
                <RotateCw size={20} />
                <Typography variant="body2" sx={{ flex: 1 }}>
                    {t('pwa.updateAvailable')}
                </Typography>
                <Button size="small" onClick={handleDismiss}>
                    {t('pwa.dismiss')}
                </Button>
                <Button size="small" variant="contained" onClick={handleReload}>
                    {t('pwa.reload')}
                </Button>
            </Box>
        </Snackbar>
    );
};
