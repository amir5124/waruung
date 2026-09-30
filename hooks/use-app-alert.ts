import type { AlertButton } from '@/components/AppAlert';
import { useCallback, useState } from 'react';

export interface AlertState {
    visible: boolean;
    title: string;
    message: string;
    buttons?: AlertButton[];
}

export function useAppAlert() {
    const [state, setState] = useState<AlertState>({
        visible: false,
        title: '',
        message: '',
        buttons: undefined,
    });

    const showAlert = useCallback(
        (title: string, message: string, buttons?: AlertButton[]) => {
            setState({ visible: true, title, message, buttons });
        },
        []
    );

    const hideAlert = useCallback(() => {
        setState((s) => ({ ...s, visible: false }));
    }, []);

    return { alertState: state, showAlert, hideAlert };
}