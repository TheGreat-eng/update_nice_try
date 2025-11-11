// src/pages/CreateRulePage.tsx
import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Select, Space, Card, Typography, message } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createRule } from '../api/ruleService';
import type { Rule } from '../types/rule';
import { useFarm } from '../context/FarmContext';
import type { Device } from '../types/device';
import { getDevicesByFarm } from '../api/deviceService';

const { Title } = Typography;
const { Option } = Select;

const CreateRulePage: React.FC = () => {
    const { farmId } = useFarm();
    const [form] = Form.useForm();
    const navigate = useNavigate();
    //const [devices, setDevices] = useState<Device[]>([]);
    const [sensors, setSensors] = useState<Device[]>([]);
    const [actuators, setActuators] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchDevices = async () => {
            if (!farmId) return;
            try {
                const response = await getDevicesByFarm(farmId);
                const allDevices: Device[] = response.data.data; // Lấy dữ liệu và gán vào biến cục bộ

                // setDevices(allDevices); // <-- XÓA DÒNG NÀY

                // Dùng trực tiếp biến 'allDevices' để set sensors và actuators
                setSensors(allDevices.filter(d => d.type.startsWith('SENSOR')));
                setActuators(allDevices.filter(d => d.type.startsWith('ACTUATOR')));
            } catch (error) {
                console.error('Failed to fetch devices:', error);
                message.error('Không thể tải danh sách thiết bị');
            }
        };

        fetchDevices();
    }, [farmId]);

    const onFinish = async (values: any) => {
        setLoading(true);
        if (!farmId) { // <-- THÊM KIỂM TRA Ở ĐÂY
            message.error("Vui lòng chọn một nông trại!");
            return;
        }
        const newRule: Rule = {
            ...values,
            enabled: true,
        };
        try {
            await createRule(farmId, newRule); // ✅ SỬA: Dùng farmId từ Context
            message.success('Tạo quy tắc thành công!');
            navigate('/rules');
        } catch (error) {
            console.error('Failed to create rule:', error);
            message.error('Tạo quy tắc thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Title level={2}>Tạo Quy tắc Mới</Title>
            <Form form={form} layout="vertical" onFinish={onFinish}>
                <Card title="Thông tin chung">
                    <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Vui lòng nhập tên quy tắc!' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea />
                    </Form.Item>
                </Card>

                <Card title="Điều kiện (NẾU)" style={{ marginTop: 16 }}>
                    <Form.List name="conditions">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                        <Form.Item {...restField} name={[name, 'type']} initialValue="SENSOR_VALUE" noStyle>
                                            <Input type="hidden" />
                                        </Form.Item>
                                        {/* ✅ THÊM: Select thiết bị sensor */}
                                        <Form.Item {...restField} name={[name, 'deviceId']} rules={[{ required: true, message: 'Chọn cảm biến!' }]}>
                                            <Select placeholder="Chọn cảm biến" style={{ width: 150 }}>
                                                {sensors.map(s => <Option key={s.deviceId} value={s.deviceId}>{s.deviceId}</Option>)}
                                                {/* ✅ SỬA: Dùng s.deviceId thay vì s.name */}
                                            </Select>
                                        </Form.Item>
                                        <span> có </span>
                                        <Form.Item {...restField} name={[name, 'field']} rules={[{ required: true }]}>
                                            <Select style={{ width: 130 }}>
                                                <Option value="temperature">nhiệt độ</Option>
                                                <Option value="humidity">độ ẩm KK</Option>
                                                <Option value="soil_moisture">độ ẩm đất</Option>
                                            </Select>
                                        </Form.Item>
                                        <Form.Item {...restField} name={[name, 'operator']} rules={[{ required: true }]}>
                                            <Select style={{ width: 120 }}>
                                                <Option value="LESS_THAN">nhỏ hơn</Option>
                                                <Option value="GREATER_THAN">lớn hơn</Option>
                                            </Select>
                                        </Form.Item>
                                        <Form.Item {...restField} name={[name, 'value']} rules={[{ required: true }]}>
                                            <Input placeholder="Giá trị" style={{ width: 80 }} />
                                        </Form.Item>
                                        <MinusCircleOutlined onClick={() => remove(name)} />
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

                <Card title="Hành động (THÌ)" style={{ marginTop: 16 }}>
                    <Form.List name="actions">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                        <Form.Item {...restField} name={[name, 'type']} rules={[{ required: true }]}>
                                            <Select style={{ width: 120 }}>
                                                <Option value="TURN_ON_DEVICE">Bật thiết bị</Option>
                                                <Option value="TURN_OFF_DEVICE">Tắt thiết bị</Option>
                                            </Select>
                                        </Form.Item>
                                        {/* ✅ THÊM: Select thiết bị actuator */}
                                        <Form.Item {...restField} name={[name, 'deviceId']} rules={[{ required: true, message: 'Chọn thiết bị!' }]}>
                                            <Select placeholder="Chọn thiết bị" style={{ width: 150 }}>
                                                {actuators.map(a => <Option key={a.deviceId} value={a.deviceId}>{a.deviceId}</Option>)}
                                                {/* ✅ SỬA: Dùng a.deviceId thay vì a.name */}
                                            </Select>
                                        </Form.Item>
                                        <span> trong </span>
                                        <Form.Item {...restField} name={[name, 'durationSeconds']}>
                                            <Input placeholder="Số giây" style={{ width: 80 }} />
                                        </Form.Item>
                                        <MinusCircleOutlined onClick={() => remove(name)} />
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
                    <Button type="primary" htmlType="submit" loading={loading}>
                        Lưu quy tắc
                    </Button>
                    <Button style={{ marginLeft: 8 }} onClick={() => navigate('/rules')}>
                        Hủy
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default CreateRulePage;