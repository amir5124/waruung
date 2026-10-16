// lib/useAppAlert.tsx
// Hook kecil pembungkus AppAlert supaya pemakaiannya seperti Alert.alert:
//   const { showAlert, alertNode } = useAppAlert();
//   showAlert('Judul', 'Pesan', [{ text: 'OK' }]);
//   ... render {alertNode} di dalam layar.
import AppAlert from '@/components/AppAlert';
import { useCallback, useState } from 'react';

type Btn = { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
type State = { visible: boolean; title: string; message: string; buttons?: Btn[] };

export function useAppAlert() {
    const [state, setState] = useState<State>({ visible: false, title: '', message: '', buttons: undefined });

    const showAlert = useCallback((title: string, message = '', buttons?: Btn[]) => {
        setState({ visible: true, title, message, buttons });
    }, []);
    const hideAlert = useCallback(() => setState((a) => ({ ...a, visible: false })), []);

    const alertNode = (
        <AppAlert
            visible={state.visible}
            title={state.title}
            message={state.message}
            buttons={state.buttons}
            onClose={hideAlert}
        />
    );
    return { showAlert, hideAlert, alertNode };
}