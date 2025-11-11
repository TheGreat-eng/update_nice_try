// src/components/DeviceFormModal.tsx
import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Button } from 'antd';
import type { DeviceFormData } from '../api/deviceService';
import { DEVICE_TYPES } from '../constants/device'; // ✅ THÊM

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: (values: DeviceFormData) => void;
    initialData?: DeviceFormData | null;
    loading: boolean;
}

const { Option } = Select;

const DeviceFormModal: React.FC<Props> = ({ visible, onClose, onSubmit, initialData, loading }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (visible) {
            if (initialData) {
                form.setFieldsValue(initialData);
            } else {
                form.resetFields();
            }
        }
    }, [initialData, visible, form]);

    const handleOk = () => {
        form.validateFields()
            .then(values => {
                onSubmit(values);
            })
            .catch(info => {
                console.log('Validate Failed:', info);
            });
    };

    return (
        <Modal
            title={initialData ? "Sửa thông tin thiết bị" : "Thêm thiết bị mới"}
            open={visible}
            onCancel={onClose}
            footer={[
                <Button key="back" onClick={onClose}>Hủy</Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleOk}>Lưu</Button>,
            ]}
        >
            <Form form={form} layout="vertical" name="device_form">
                <Form.Item name="name" label="Tên thiết bị" rules={[{ required: true, message: 'Vui lòng nhập tên thiết bị!' }]}>
                    <Input />
                </Form.Item>
                <Form.Item
                    name="deviceId"
                    label="Device ID (Mã định danh)"
                    rules={[
                        { required: true, message: 'Vui lòng nhập Device ID!' },
                        {
                            pattern: /^[A-Z0-9-]+$/,
                            message: 'Device ID chỉ được chứa chữ in hoa, số và dấu gạch ngang!'
                        },
                        {
                            min: 3,
                            message: 'Device ID phải có ít nhất 3 ký tự!'
                        }
                    ]}
                >
                    <Input disabled={!!initialData} placeholder="VD: DHT22-001" />
                </Form.Item>
                <Form.Item name="type" label="Loại thiết bị" rules={[{ required: true, message: 'Vui lòng chọn loại thiết bị!' }]}>
                    <Select placeholder="Chọn loại">
                        {/* ✅ SỬA: Dùng constants */}
                        {Object.values(DEVICE_TYPES).map(type => (
                            <Option key={type.value} value={type.value}>
                                {type.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="description" label="Mô tả">
                    <Input.TextArea rows={2} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default DeviceFormModal;















