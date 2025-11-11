// src/pages/FarmsPage.tsx
import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Button, Typography, Spin, message, Popconfirm, Empty, Tag, Statistic } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons'; // ✅ Dùng lucide-react
import { getFarms, createFarm, updateFarm, deleteFarm } from '../api/farmService';
import type { Farm, FarmFormData } from '../types/farm';
import FarmFormModal from '../components/FarmFormModal';
import { useFarm } from '../context/FarmContext';
import { useApiCall } from '../hooks/useApiCall';
import { SUCCESS_MESSAGES } from '../constants/messages';
import { MapPin } from 'lucide-react';

const { Title, Text, Paragraph } = Typography;

const FarmsPage: React.FC = () => {
    const { farmId, setFarmId } = useFarm();
    const [farms, setFarms] = useState<Farm[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingFarm, setEditingFarm] = useState<Farm | null>(null);

    const { loading, execute: fetchFarmsApi } = useApiCall<Farm[]>({
        onSuccess: (data) => setFarms(data),
    });

    const { loading: formLoading, execute: saveFarmApi } = useApiCall({
        showSuccessMessage: true,
    });

    const { execute: deleteFarmApi } = useApiCall({
        successMessage: SUCCESS_MESSAGES.FARM_DELETED,
        showSuccessMessage: true,
    });

    const fetchFarms = async () => {
        try {
            await fetchFarmsApi(async () => {
                const response = await getFarms();
                const farmData = response.data.data || response.data;
                return Array.isArray(farmData) ? farmData : [];
            });
        } catch (error) { console.error('Failed to fetch farms:', error); }
    };

    useEffect(() => { fetchFarms(); }, []);

    const handleFormSubmit = async (values: FarmFormData) => {
        try {
            await saveFarmApi(async () => {
                if (editingFarm) {
                    await updateFarm(editingFarm.id, values);
                    message.success(SUCCESS_MESSAGES.FARM_UPDATED);
                } else {
                    await createFarm(values);
                    message.success(SUCCESS_MESSAGES.FARM_CREATED);
                }
            });
            setIsModalVisible(false);
            fetchFarms();
        } catch (error) { console.error('Failed to save farm:', error); }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteFarmApi(() => deleteFarm(id));
            // ✅ Nếu xóa farm đang chọn, reset farmId
            if (farmId === id) {
                setFarmId(null);
            }
            fetchFarms();
        } catch (error) { console.error('Failed to delete farm:', error); }
    };

    const openModal = (farm: Farm | null) => {
        setEditingFarm(farm);
        setIsModalVisible(true);
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>Quản lý Nông trại</Title>
                    <Text type="secondary">Tất cả nông trại của bạn ở cùng một nơi.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Thêm nông trại</Button>
            </div>

            {farms.length > 0 ? (
                <Row gutter={[24, 24]}>
                    {farms.map(farm => (
                        <Col xs={24} sm={12} lg={8} key={farm.id}>
                            <Card
                                hoverable
                                style={{
                                    border: farmId === farm.id ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                                    boxShadow: farmId === farm.id ? '0 0 0 3px rgba(99, 102, 241, 0.2)' : 'none',
                                    display: 'flex', flexDirection: 'column', height: '100%',
                                }}
                                bodyStyle={{ flexGrow: 1, padding: 20 }}
                                actions={[
                                    <Button type="text" icon={<EditOutlined />} onClick={() => openModal(farm)}>Sửa</Button>,
                                    <Popconfirm
                                        title="Xóa nông trại này?"
                                        onConfirm={() => handleDelete(farm.id)}
                                        okText="Xóa" cancelText="Hủy"
                                    >
                                        <Button type="text" danger icon={<DeleteOutlined />}>Xóa</Button>
                                    </Popconfirm>,
                                    <Button type="primary" onClick={() => { setFarmId(farm.id); message.success(`Đã chọn nông trại ${farm.name}`); }} disabled={farmId === farm.id}>Chọn</Button>
                                ]}
                            >
                                <Title level={4} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                                    {farm.name}
                                    {farmId === farm.id && (
                                        <Tag icon={<CheckCircleOutlined />} color="processing" style={{ marginLeft: 8 }}>Đang chọn</Tag>
                                    )}
                                </Title>
                                <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                                    <MapPin size={14} /> {farm.location || 'Chưa có vị trí'}
                                </Text>
                                <Paragraph type="secondary" ellipsis={{ rows: 2, expandable: true, symbol: 'thêm' }}>
                                    {farm.description || 'Không có mô tả.'}
                                </Paragraph>
                                <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                                    <Statistic title="Thiết bị Online" value={farm.onlineDevices ?? 0} suffix={`/ ${farm.totalDevices ?? 0}`} />
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <Empty description="Bạn chưa có nông trại nào" style={{ marginTop: 64 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Tạo nông trại đầu tiên</Button>
                </Empty>
            )}

            <FarmFormModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} onSubmit={handleFormSubmit} initialData={editingFarm} loading={formLoading} />
        </div>
    );
};

export default FarmsPage;