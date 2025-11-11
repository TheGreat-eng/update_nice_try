// src/hooks/useStomp.ts
import { useEffect, useState } from 'react';
import { Client, type IFrame, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client'; // Cần cài đặt: npm install sockjs-client @types/sockjs-client
import { getAuthToken } from '../utils/auth';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';

export const useStomp = (topicId: number | string | null, type: 'farm' | 'user' = 'farm') => {
    const [stompClient, setStompClient] = useState<Client | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!topicId) {
            console.warn(`STOMP: No ${type}Id, connection skipped.`);
            return;
        }

        const token = getAuthToken();
        if (!token) {
            console.warn('STOMP: No auth token, connection skipped.');
            return;
        }

        console.log(`STOMP: Initializing connection for ${type} ${topicId}...`);

        const client = new Client({
            // Sử dụng SockJS làm transport
            webSocketFactory: () => new SockJS(WS_URL),
            connectHeaders: {
                Authorization: `Bearer ${token}`,
            },
            debug: (str) => {
                console.log('STOMP DEBUG:', str);
            },
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = (frame: IFrame) => {
            console.log('✅ STOMP: Connected:', frame);
            setIsConnected(true);
            setStompClient(client);
        };

        client.onStompError = (frame: IFrame) => {
            console.error('❌ STOMP: Broker reported error:', frame.headers['message']);
            console.error('❌ STOMP: Additional details:', frame.body);
            setIsConnected(false);
        };

        client.onDisconnect = () => {
            console.log('🔌 STOMP: Disconnected!');
            setIsConnected(false);
        }

        client.activate();

        return () => {
            console.log('STOMP: Deactivating client...');
            client.deactivate();
            setIsConnected(false);
        };
    }, [topicId, type]); // ✅ Thêm dependency

    const subscribe = (topic: string, callback: (message: IMessage) => void) => {
        if (stompClient && isConnected) {
            console.log(`STOMP: Subscribing to ${topic}`);
            return stompClient.subscribe(topic, callback);
        }
        console.warn('STOMP: Client not connected, cannot subscribe.');
    };

    return { stompClient, isConnected, subscribe };
};