// src/pages/admin/UserManagementPage.tsx
import React, { useState } from 'react'; // THÊM useState
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Space, Tag, Popconfirm, message, Typography, Badge, Input } from 'antd'; // THÊM Input
import type { TableProps, PaginationProps } from 'antd';
import { LockOutlined, UnlockOutlined, DeleteOutlined } from '@ant-design/icons';
import { getAllUsers, lockUser, unlockUser, softDeleteUser } from '../../api/adminService';
import type { AdminUser } from '../../types/admin';
import { useDebounce } from '../../hooks/useDebounce'; // Import hook debounce

const { Title } = Typography;

const UserManagementPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500); // Debounce 500ms

    const { data, isLoading } = useQuery({
        // Query key phụ thuộc vào cả phân trang và tìm kiếm
        queryKey: ['admin-users', pagination.current, pagination.pageSize, debouncedSearchTerm],
        queryFn: () => getAllUsers(pagination.current - 1, pagination.pageSize, debouncedSearchTerm).then(res => res.data.data),
    });

    const mutationOptions = {
        onSuccess: () => {
            message.success('Thao tác thành công!');
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
        onError: () => {
            message.error('Thao tác thất bại!');
        },
    };

    const lockMutation = useMutation({ mutationFn: lockUser, ...mutationOptions });
    const unlockMutation = useMutation({ mutationFn: unlockUser, ...mutationOptions });
    const deleteMutation = useMutation({ mutationFn: softDeleteUser, ...mutationOptions });

    const handleTableChange = (newPagination: PaginationProps) => {
        setPagination({
            current: newPagination.current || 1,
            pageSize: newPagination.pageSize || 10,
        });
    };

    const columns: TableProps<AdminUser>['columns'] = [
        { title: 'ID', dataIndex: 'id', key: 'id' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            render: (role) => <Tag color={role === 'ADMIN' ? 'volcano' : 'geekblue'}>{role.toUpperCase()}</Tag>,
        },
        {
            title: 'Trạng thái',
            key: 'status',
            render: (_, record) => (
                <Space>
                    <Badge status={record.enabled ? 'success' : 'default'} text={record.enabled ? 'Hoạt động' : 'Bị khóa'} />
                    {record.deleted && <Tag color="error">Đã xóa</Tag>}
                </Space>
            ),
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    {record.enabled ? (
                        <Button icon={<LockOutlined />} onClick={() => lockMutation.mutate(record.id)} danger>Khóa</Button>
                    ) : (
                        <Button icon={<UnlockOutlined />} onClick={() => unlockMutation.mutate(record.id)}>Mở khóa</Button>
                    )}
                    <Popconfirm
                        title="Xóa người dùng?"
                        description="Người dùng sẽ bị ẩn đi. Bạn chắc chứ?"
                        onConfirm={() => deleteMutation.mutate(record.id)}
                    >
                        <Button icon={<DeleteOutlined />} danger type="dashed">Xóa</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Title level={2}>Quản lý Người dùng</Title>
                <Input.Search
                    placeholder="Tìm kiếm theo email hoặc tên..."
                    onSearch={value => setSearchTerm(value)}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ maxWidth: 400 }}
                />
                <Table
                    columns={columns}
                    dataSource={data?.content}
                    loading={isLoading}
                    rowKey="id"
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: data?.totalElements,
                    }}
                    onChange={handleTableChange} // Thêm handler
                />
            </Space>
        </div>
    );
};

export default UserManagementPage;