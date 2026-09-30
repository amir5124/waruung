import React, {
    createContext,
    ReactNode,
    useContext,
    useState,
} from 'react';

export type ServiceRoute =
    | '/services/ojek-motor'
    | '/services/ojek-mobil'
    | '/services/kurir'
    | '/services/warfood';

type OrderContextType = {
    activeOrderId: number | null;
    activeService: ServiceRoute | null;
    setActiveOrder: (
        orderId: number | null,
        service?: ServiceRoute | null
    ) => void;

    activeRoomId: number | null;
    setActiveRoomId: (id: number | null) => void;

    // ---- Guard global untuk boot dari notif ----
    /** Order id yang sedang di-boot (null = tidak ada) */
    bootingOrderId: number | null;
    setBootingOrderId: (id: number | null) => void;

    /** Order id yang sudah selesai di-boot (untuk skip boot ulang) */
    bootedOrderId: number | null;
    setBootedOrderId: (id: number | null) => void;
};

const OrderContext = createContext<OrderContextType>({
    activeOrderId: null,
    activeService: null,
    setActiveOrder: () => { },
    activeRoomId: null,
    setActiveRoomId: () => { },
    bootingOrderId: null,
    setBootingOrderId: () => { },
    bootedOrderId: null,
    setBootedOrderId: () => { },
});

export const useOrder = () => useContext(OrderContext);

export function OrderProvider({ children }: { children: ReactNode }) {
    const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
    const [activeService, setActiveService] = useState<ServiceRoute | null>(
        null
    );
    const [activeRoomId, setActiveRoomId] = useState<number | null>(null);

    // Guard global
    const [bootingOrderId, setBootingOrderId] = useState<number | null>(null);
    const [bootedOrderId, setBootedOrderId] = useState<number | null>(null);

    const setActiveOrder = (
        orderId: number | null,
        service: ServiceRoute | null = null
    ) => {
        setActiveOrderId(orderId);
        setActiveService(service);
    };

    return (
        <OrderContext.Provider
            value={{
                activeOrderId,
                activeService,
                setActiveOrder,
                activeRoomId,
                setActiveRoomId,
                bootingOrderId,
                setBootingOrderId,
                bootedOrderId,
                setBootedOrderId,
            }}
        >
            {children}
        </OrderContext.Provider>
    );
}