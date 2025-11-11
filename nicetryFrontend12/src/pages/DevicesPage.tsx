// src/pages/DevicesPage.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Space, Tag, Popconfirm, Input, Spin, Alert, Tooltip, Typography, Modal, message } from 'antd'; // Thêm Tooltip, Badge
import { PlusOutlined, DownloadOutlined, EditOutlined, DeleteOutlined, SyncOutlined, ThunderboltOutlined, WifiOutlined as WifiIcon, StopOutlined } from '@ant-design/icons';
import { getDevicesByFarm, createDevice, updateDevice, deleteDevice, controlDevice } from '../api/deviceService';
import type { Device } from '../types/device';
import { useFarm } from '../context/FarmContext';
import DeviceFormModal from '../components/DeviceFormModal';
import type { DeviceFormData } from '../api/deviceService';
import { useApiCall } from '../hooks/useApiCall';
import { DEVICE_STATUS, DEVICE_STATE, getDeviceTypeLabel } from '../constants/device';
import { SUCCESS_MESSAGES } from '../constants/messages';
import { useDebounce } from '../hooks/useDebounce';
import { exportDeviceDataAsCsv } from '../api/reportService';
import { message as antdMessage } from 'antd';

import { useStomp } from '../hooks/useStomp'; // ✅ Import hook useStomp
import type { DeviceStatusMessage } from '../types/websocket';




import { TableSkeleton } from '../components/LoadingSkeleton';

const { Title, Text } = Typography;

const PageHeader = ({ title, subtitle, actions }: { title: string, subtitle: string, actions: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
            <Title level={2} style={{ margin: 0 }}>{title}</Title>
            <Text type="secondary">{subtitle}</Text>
        </div>
        <Space>{actions}</Space>
    </div>
);

const DevicesPage: React.FC = () => {
    const { farmId, isLoadingFarm } = useFarm(); // ✅ THÊM isLoadingFarm
    const [devices, setDevices] = useState<Device[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingDevice, setEditingDevice] = useState<Device | null>(null);
    const [controllingDevices, setControllingDevices] = useState<Set<string>>(new Set());
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);
    // ✅ THÊM LOGIC STOMP/WEBSOCKET
    const { stompClient, isConnected } = useStomp(farmId);

    useEffect(() => {
        if (isConnected && stompClient) {
            console.log('Subscribing to device status topic...');
            const subscription = stompClient.subscribe(
                `/topic/farm/${farmId}/device-status`,
                (message) => {
                    try {
                        const statusUpdate: DeviceStatusMessage = JSON.parse(message.body);
                        console.log('Received device status update:', statusUpdate);

                        // Cập nhật trạng thái của thiết bị trong danh sách
                        setDevices(prevDevices =>
                            prevDevices.map(device =>
                                device.deviceId === statusUpdate.deviceId
                                    ? { ...device, status: statusUpdate.status, lastSeen: statusUpdate.timestamp }
                                    : device
                            )
                        );

                        // Hiển thị một thông báo nhỏ (tùy chọn)
                        antdMessage.info(`Thiết bị ${statusUpdate.deviceId} đã ${statusUpdate.status.toLowerCase()}.`, 2);

                    } catch (error) {
                        console.error('Failed to parse device status message:', error);
                    }
                }
            );

            // Cleanup subscription khi component unmount hoặc farmId thay đổi
            return () => {
                console.log('Unsubscribing from device status topic...');
                subscription.unsubscribe();
            };
        }
    }, [isConnected, stompClient, farmId]);

    const { loading, execute: fetchDevicesApi } = useApiCall<Device[]>({
        onSuccess: (data) => setDevices(data)
    });

    const { loading: formLoading, execute: saveDeviceApi } = useApiCall({
        showSuccessMessage: true,
    });

    const { execute: deleteDeviceApi } = useApiCall({
        successMessage: SUCCESS_MESSAGES.DEVICE_DELETED,
        showSuccessMessage: true,
    });

    const fetchDevices = async () => {
        if (!farmId) {
            console.warn('⚠️ No farmId available');
            return;
        }

        try {
            console.log('🔍 Fetching devices for farmId:', farmId);
            await fetchDevicesApi(async () => {
                const response = await getDevicesByFarm(farmId);
                console.log('✅ Devices loaded:', response.data.data.length);
                return response.data.data;
            });
        } catch (error) {
            console.error('❌ Failed to fetch devices:', error);
        }
    };

    useEffect(() => {
        if (farmId) {
            fetchDevices();
        }
    }, [farmId]);

    // ✅ THÊM: Early return khi đang load farm
    if (isLoadingFarm) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <Spin size="large" tip="Đang tải nông trại..." />
            </div>
        );
    }

    // ✅ THÊM: Early return khi chưa có farmId
    if (!farmId) {
        return (
            <div style={{ padding: '24px' }}>
                <Alert
                    message="Chưa chọn nông trại"
                    description="Vui lòng chọn hoặc tạo nông trại từ menu trên để xem thiết bị."
                    type="warning"
                    showIcon
                    action={
                        <Button type="primary" onClick={() => window.location.href = '/farms'}>
                            Đến trang Nông trại
                        </Button>
                    }
                />
            </div>
        );
    }

    const showModal = (device?: Device) => {
        setEditingDevice(device || null);
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        setEditingDevice(null);
    };

    const handleSubmit = async (values: DeviceFormData) => {
        try {
            await saveDeviceApi(async () => {
                if (editingDevice) {
                    await updateDevice(editingDevice.id, values);
                    antdMessage.success(SUCCESS_MESSAGES.DEVICE_UPDATED);
                } else {
                    await createDevice(farmId, values);
                    antdMessage.success(SUCCESS_MESSAGES.DEVICE_CREATED);
                }
            });
            handleCancel();
            fetchDevices();
        } catch (error) {
            console.error('Failed to save device:', error);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteDeviceApi(() => deleteDevice(id));
            fetchDevices();
        } catch (error) {
            console.error('Failed to delete device:', error);
        }
    };

    const handleControl = async (deviceId: string, action: 'turn_on' | 'turn_off') => {
        const device = devices.find(d => d.deviceId === deviceId);

        if (device?.status === DEVICE_STATUS.OFFLINE) {
            Modal.confirm({
                title: '⚠️ Thiết bị đang Offline',
                content: 'Thiết bị hiện không kết nối. Lệnh sẽ được gửi khi thiết bị online. Tiếp tục?',
                okText: 'Tiếp tục',
                cancelText: 'Hủy',
                onOk: () => executeControl(deviceId, action),
            });
            return;
        }

        executeControl(deviceId, action);
    };

    const executeControl = async (deviceId: string, action: 'turn_on' | 'turn_off') => {
        setControllingDevices(prev => new Set(prev).add(deviceId));

        const newState = action === 'turn_on' ? DEVICE_STATE.ON : DEVICE_STATE.OFF;

        // Optimistic update
        setDevices(prevDevices =>
            prevDevices.map(d =>
                d.deviceId === deviceId
                    ? { ...d, currentState: newState }
                    : d
            )
        );

        try {
            await controlDevice(deviceId, action);
            antdMessage.success(`Đã ${action === 'turn_on' ? 'bật' : 'tắt'} thiết bị ${deviceId}`);
            setTimeout(fetchDevices, 1000);
        } catch (error) {
            // ✅ ROLLBACK AN TOÀN HƠN
            setDevices(prevDevices =>
                prevDevices.map(d => {
                    if (d.deviceId === deviceId) {
                        const rollbackState = action === 'turn_on' ? DEVICE_STATE.OFF : DEVICE_STATE.ON;
                        // ✅ Giữ lại currentState cũ nếu có, nếu không thì dùng rollbackState
                        return {
                            ...d,
                            currentState: d.currentState !== undefined ? rollbackState : undefined
                        };
                    }
                    return d;
                })
            );
            message.error('Không thể điều khiển thiết bị. Vui lòng thử lại.');
        } finally {
            setControllingDevices(prev => {
                const newSet = new Set(prev);
                newSet.delete(deviceId);
                return newSet;
            });
        }
    };

    // Filter devices based on debounced search
    const filteredDevices = useMemo(() => {
        if (!debouncedSearchText) return devices;

        const lowerSearch = debouncedSearchText.toLowerCase();
        return devices.filter(d =>
            d.name.toLowerCase().includes(lowerSearch) ||
            d.deviceId.toLowerCase().includes(lowerSearch)
        );
    }, [devices, debouncedSearchText]);

    const columns = [
        {
            title: 'Device ID',
            dataIndex: 'deviceId',
            key: 'deviceId',
            width: 150,
        },
        {
            title: 'Tên thiết bị',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            key: 'type',
            width: 180,
            render: (type: string) => getDeviceTypeLabel(type),
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 160,
            render: (_: any, record: Device) => (
                <Space direction="vertical" size={4}>
                    <Tag
                        icon={record.status === DEVICE_STATUS.ONLINE ? <WifiIcon /> : <StopOutlined />}
                        color={record.status === DEVICE_STATUS.ONLINE ? 'success' : 'error'}
                        style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        {record.status === DEVICE_STATUS.ONLINE ? 'Online' : 'Offline'}
                    </Tag>
                    {/* ✅ KIỂM TRA currentState tồn tại VÀ có giá trị */}
                    {record.type.startsWith('ACTUATOR') && record.currentState !== undefined && record.currentState !== null && (
                        <Tag
                            color={record.currentState === DEVICE_STATE.ON ? 'processing' : 'default'}
                            style={{ margin: 0 }}
                        >
                            {record.currentState === DEVICE_STATE.ON ? 'Đang bật' : 'Đang tắt'}
                        </Tag>
                    )}
                </Space>
            ),
        },
        {
            title: 'Lần hoạt động cuối',
            dataIndex: 'lastSeen',
            key: 'lastSeen',
            width: 180,
            render: (lastSeen: string) => new Date(lastSeen).toLocaleString('vi-VN'),
        },
        {
            title: 'Điều khiển',
            key: 'control',
            width: 250,
            render: (_: any, record: Device) => {
                if (!record.type.startsWith('ACTUATOR')) {
                    return <Tag color="blue">Cảm biến</Tag>;
                }

                const isLoading = controllingDevices.has(record.deviceId);
                const isOffline = record.status === DEVICE_STATUS.OFFLINE;
                // ✅ XỬ LÝ KHI currentState undefined/null
                const isOn = record.currentState === DEVICE_STATE.ON;
                const hasState = record.currentState !== undefined && record.currentState !== null;

                return (
                    <Space direction="vertical" size="small">
                        <Space>
                            {isOn ? (
                                <Button
                                    danger
                                    size="small"
                                    onClick={() => handleControl(record.deviceId, 'turn_off')}
                                    loading={isLoading}
                                    disabled={!hasState} // ✅ Disable nếu không có state
                                >
                                    🔴 Tắt
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<ThunderboltOutlined />}
                                    onClick={() => handleControl(record.deviceId, 'turn_on')}
                                    loading={isLoading}
                                    disabled={!hasState && isOffline} // ✅ Cho phép bật nếu offline nhưng có state
                                >
                                    🟢 Bật
                                </Button>
                            )}
                        </Space>
                        {isOffline && (
                            <Tag color="warning" style={{ margin: 0, fontSize: '11px' }}>
                                ⚠️ Offline - lệnh sẽ chờ
                            </Tag>
                        )}
                        {/* ✅ HIỂN THỊ CẢNH BÁO KHI THIẾU STATE */}
                        {!hasState && record.type.startsWith('ACTUATOR') && (
                            <Tag color="default" style={{ margin: 0, fontSize: '11px' }}>
                                ℹ️ Chưa có trạng thái
                            </Tag>
                        )}
                    </Space>
                );
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 180,
            fixed: 'right' as const,
            render: (_: any, record: Device) => (
                <Space size="small">
                    <Tooltip title="Sửa">
                        <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} />
                    </Tooltip>
                    <Tooltip title="Xóa">
                        <Popconfirm
                            title="Xóa thiết bị?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </Tooltip>
                    <Tooltip title="Xuất CSV">
                        <Button type="text" icon={<DownloadOutlined />} onClick={() => {
                            const end = new Date().toISOString();
                            const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                            exportDeviceDataAsCsv(record.deviceId, start, end);
                        }} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    if (loading && devices.length === 0) {
        return <TableSkeleton />;
    }



    return (
        <div>
            <PageHeader
                title="Quản lý Thiết bị"
                subtitle={`${devices.length} thiết bị trong nông trại này`}
                actions={
                    <>
                        <Input.Search
                            placeholder="Tìm kiếm..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 250 }}
                            allowClear
                        />
                        <Button icon={<SyncOutlined />} onClick={fetchDevices} loading={loading} />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
                            Thêm mới
                        </Button>
                    </>
                }
            />
            <Table
                columns={columns}
                dataSource={filteredDevices}
                rowKey="id"
                loading={loading} // Giữ lại loading prop để hiển thị spinner khi refresh
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1200 }}
            />
            {isModalVisible && (
                <DeviceFormModal
                    visible={isModalVisible}
                    onClose={handleCancel}
                    onSubmit={handleSubmit}
                    initialData={editingDevice ? {
                        name: editingDevice.name,
                        deviceId: editingDevice.deviceId,
                        type: editingDevice.type,
                    } : null}
                    loading={formLoading}
                />
            )}
        </div>
    );
};

export default DevicesPage;