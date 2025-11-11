// src/pages/EditRulePage.tsx

import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Select, Space, Card, Typography, message, Spin, Alert } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { getRuleById, updateRule } from '../api/ruleService';
import type { Rule } from '../types/rule';
import { useFarm } from '../context/FarmContext';
import { getDevicesByFarm } from '../api/deviceService';
import type { Device } from '../types/device';

const { Title } = Typography;
const { Option } = Select;

const EditRulePage: React.FC = () => {
    const navigate = useNavigate();
    const { ruleId } = useParams<{ ruleId: string }>();
    const { farmId } = useFarm(); // Lấy farmId từ context
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false); // Thêm state cho lúc submit
    const [error, setError] = useState<string | null>(null);

    // State để lưu danh sách thiết bị
    const [sensors, setSensors] = useState<Device[]>([]);
    const [actuators, setActuators] = useState<Device[]>([]);

    // Effect để tải dữ liệu quy tắc và danh sách thiết bị
    useEffect(() => {
        if (!ruleId || !farmId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Tải đồng thời cả hai
                const [ruleResponse, devicesResponse] = await Promise.all([
                    getRuleById(parseInt(ruleId)),
                    getDevicesByFarm(farmId)
                ]);

                // Xử lý dữ liệu quy tắc
                form.setFieldsValue(ruleResponse.data.data);

                // Xử lý danh sách thiết bị
                const allDevices = devicesResponse.data.data;
                setSensors(allDevices.filter(d => d.type.startsWith('SENSOR')));
                setActuators(allDevices.filter(d => d.type.startsWith('ACTUATOR')));

                setError(null);
            } catch (err) {
                console.error("Failed to fetch data:", err);
                setError("Không thể tải thông tin quy tắc hoặc danh sách thiết bị.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [ruleId, farmId, form]);

    const onFinish = async (values: any) => {
        if (!ruleId) return;
        setSubmitting(true);

        // Lấy lại giá trị enabled vì nó không có trong form
        const currentRuleData = form.getFieldsValue(true);
        const updatedRule: Rule = {
            ...values,
            id: parseInt(ruleId),
            enabled: currentRuleData.enabled,
        };

        try {
            await updateRule(parseInt(ruleId), updatedRule);
            message.success('Cập nhật quy tắc thành công!');
            navigate('/rules');
        } catch (error) {
            message.error('Cập nhật quy tắc thất bại!');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <Spin tip="Đang tải quy tắc..." size="large" />
            </div>
        );
    }

    if (error) {
        return <Alert message="Lỗi" description={error} type="error" showIcon />;
    }

    return (
        <div>
            <Title level={2}>Sửa Quy tắc</Title>
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ conditions: [{}], actions: [{}] }}>
                <Card title="Thông tin chung" style={{ marginBottom: 16 }}>
                    <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Vui lòng nhập tên!' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Card>

                <Card title="Điều kiện (NẾU)" style={{ marginBottom: 16 }}>
                    <Form.List name="conditions">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Space key={key} style={{ display: 'flex', marginBottom: 8, alignItems: 'start' }} align="baseline">
                                        <Form.Item {...restField} name={[name, 'type']} initialValue="SENSOR_VALUE" noStyle><Input type="hidden" /></Form.Item>

                                        {/* VVVV--- ĐÃ THAY THẾ BẰNG SELECT ---VVVV */}
                                        <Form.Item {...restField} name={[name, 'deviceId']} label="Cảm biến" rules={[{ required: true, message: 'Chọn cảm biến!' }]}>
                                            <Select placeholder="Chọn cảm biến" style={{ width: 200 }} showSearch optionFilterProp="children">
                                                {sensors.map(s => <Option key={s.deviceId} value={s.deviceId}>{s.name} ({s.deviceId})</Option>)}
                                            </Select>
                                        </Form.Item>
                                        {/* ^^^^---------------------------------^^^^ */}

                                        <Form.Item {...restField} name={[name, 'field']} label="Chỉ số" rules={[{ required: true }]}>
                                            <Select style={{ width: 130 }}>
                                                <Option value="temperature">Nhiệt độ</Option>
                                                <Option value="humidity">Độ ẩm KK</Option>
                                                <Option value="soil_moisture">Độ ẩm đất</Option>
                                                <Option value="light_intensity">Ánh sáng</Option>
                                                <Option value="soilPH">pH đất</Option>
                                            </Select>
                                        </Form.Item>
                                        <Form.Item {...restField} name={[name, 'operator']} label="Toán tử" rules={[{ required: true }]}>
                                            <Select style={{ width: 120 }}>
                                                <Option value="LESS_THAN">Nhỏ hơn</Option>
                                                <Option value="GREATER_THAN">Lớn hơn</Option>
                                                <Option value="EQUALS">Bằng</Option>
                                            </Select>
                                        </Form.Item>
                                        <Form.Item {...restField} name={[name, 'value']} label="Giá trị" rules={[{ required: true }]}>
                                            <Input placeholder="VD: 30" style={{ width: 100 }} />
                                        </Form.Item>
                                        <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 38 }} />
                                    </Space>
                                ))}
                                <Form.Item>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                        Thêm điều kiện
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </Card>

                <Card title="Hành động (THÌ)" style={{ marginBottom: 16 }}>
                    <Form.List name="actions">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Space key={key} style={{ display: 'flex', marginBottom: 8, alignItems: 'start' }} align="baseline">
                                        <Form.Item {...restField} name={[name, 'type']} label="Hành động" rules={[{ required: true }]}>
                                            <Select style={{ width: 150 }}>
                                                <Option value="TURN_ON_DEVICE">Bật thiết bị</Option>
                                                <Option value="TURN_OFF_DEVICE">Tắt thiết bị</Option>
                                                <Option value="SEND_EMAIL">Gửi Email</Option>
                                            </Select>
                                        </Form.Item>

                                        {/* VVVV--- ĐÃ THAY THẾ BẰNG SELECT ---VVVV */}
                                        <Form.Item {...restField} name={[name, 'deviceId']} label="Thiết bị" rules={[{ required: true, message: 'Chọn thiết bị!' }]}>
                                            <Select placeholder="Chọn thiết bị" style={{ width: 200 }} showSearch optionFilterProp="children">
                                                {actuators.map(a => <Option key={a.deviceId} value={a.deviceId}>{a.name} ({a.deviceId})</Option>)}
                                            </Select>
                                        </Form.Item>
                                        {/* ^^^^---------------------------------^^^^ */}

                                        <Form.Item {...restField} name={[name, 'durationSeconds']} label="Thời gian (giây)">
                                            <Input placeholder="VD: 300" style={{ width: 120 }} />
                                        </Form.Item>
                                        <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 38 }} />
                                    </Space>
                                ))}
                                <Form.Item>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                        Thêm hành động
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </Card>

                <Form.Item style={{ marginTop: 24 }}>
                    <Button type="primary" htmlType="submit" loading={submitting}>
                        Lưu thay đổi
                    </Button>
                    <Button style={{ marginLeft: 8 }} onClick={() => navigate('/rules')}>
                        Hủy
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default EditRulePage;